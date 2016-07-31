// webserver.go
package oddessa

// handles web interactions with users

import (
	"fmt"
	"github.com/labstack/echo"
	"github.com/labstack/echo/engine/fasthttp"
	"github.com/nats-io/nuid"
	"log"
	"os"
	"path/filepath"
	"strings"
	// "github.com/labstack/echo/engine/standard"
	"bytes"
	"encoding/gob"
	"github.com/BurntSushi/toml"
	"github.com/deluan/gomate"
	gml "github.com/deluan/gomate/ledis"
	mw "github.com/labstack/echo/middleware"
	lediscfg "github.com/siddontang/ledisdb/config"
	"github.com/siddontang/ledisdb/ledis"
	"github.com/wildducktheories/go-csv"
	"net/http"
)

type ODDESSAWebServer struct{}

// underlying data store
var ac_db = createAutoCompleteDB()
var db_engine *ledis.DB

// the three autocomplete search indexers
var elements_namespace = "elements"
var elements_indexer = gomate.NewIndexer(ac_db, elements_namespace)
var elements_searcher = gomate.NewSearcher(ac_db, elements_namespace)

var sif_namespace = "sif"
var sif_indexer = gomate.NewIndexer(ac_db, sif_namespace)
var sif_searcher = gomate.NewSearcher(ac_db, sif_namespace)

var collections_namespace = "collections"
var collections_indexer = gomate.NewIndexer(ac_db, collections_namespace)
var collections_searcher = gomate.NewSearcher(ac_db, collections_namespace)

var tomlConfig tomlUseCases

type tomlUseCases struct {
	UseCases map[string]*usecase
}

type usecase struct {
	Name    string
	Objects []string
}

type SearchResult struct {
	Query   string
	Labels  []string
	Indexes []string
}

type SearchResultContent struct {
	Collection      string
	CollectionFrame string
	DataElement     string
	Definition      string
	Usage           string
	SIFElement      string
	SIFObject       string
	DocID           string
}

func createAutoCompleteDB() gomate.DB {

	cfg := lediscfg.NewConfigDefault()
	l, _ := ledis.Open(cfg)
	db_engine, _ = l.Select(0)
	return gml.NewEmbeddedDB(db_engine)

}

func loadUseCaseDefinitions() {
	if _, err := toml.DecodeFile("./data/use_cases.toml", &tomlConfig); err != nil {
		log.Fatalln("Unable to read use case definitions", err)
	}
	log.Println("use case definitions read ok")
}

func loadCollectionData() {

	db_engine.FlushAll()

	fileDir := "./data/collections/"

	fileNames, _ := filepath.Glob(fileDir + "*.csv")
	for _, file := range fileNames {
		log.Println("reading file: ", file)
		f, err := os.Open(file)
		if err != nil {
			log.Println("File reader error: ", err)
		}
		reader := csv.WithIoReader(f)
		records, err := csv.ReadAll(reader)
		if err != nil {
			log.Println("Unable to read collection file ", file, err)
		}

		for _, r := range records {

			// index for search
			doc_id := nuid.Next()
			r := r.AsMap()

			t := r["Data Element"]
			err := elements_indexer.Index(doc_id, strings.ToLower(t))
			if err != nil {
				log.Println("element indexing error: ", err)
			}

			// add sif lookup
			t = r["SIF Object"]
			err = sif_indexer.Index(doc_id, strings.ToLower(t))
			if err != nil {
				log.Println("sif indexing error: ", err)
			}

			// add collections lookup
			t = r["Collection"]
			err = collections_indexer.Index(doc_id, strings.ToLower(t))
			if err != nil {
				log.Println("collection indexing error: ", err)
			}

			// or - render doc as struct and save once!!
			err = db_engine.Set([]byte(doc_id), EncodeDocument(r))
			if err != nil {
				log.Println("Error saving whole document", err)
			}

		}
		log.Println("Collection file read: ", file)
	}

	log.Println("...all Collection records loaded")

}

func getSearchResults(index string, query string) SearchResult {

	sr := SearchResult{}

	var searcher gomate.Searcher
	var namespace string
	switch index {
	case "elements":
		searcher = elements_searcher
		namespace = elements_namespace
	case "sif":
		searcher = sif_searcher
		namespace = sif_namespace
	case "collections":
		searcher = collections_searcher
		namespace = collections_namespace
	default:
		searcher = elements_searcher
		namespace = elements_namespace
	}

	res, err := searcher.Search(query, 0, -1)
	if err != nil {
		log.Println("Searching error: ", err)
	}
	// log.Println("results:", res)

	keyspace := fmt.Sprintf("%s:%s", namespace, gomate.IdSetSuffix)
	list, err := ac_db.Hmget(keyspace, res...)
	if err != nil {
		log.Println("search error: ", err)
	}
	// log.Println("list is: ", list)

	sr.Indexes = res
	sr.Query = query
	sr.Labels = list

	return sr

}

// binary encding for messages going to internal q/store, in nats qs this is
// handled automatically by the use of gob encoder on connection
func EncodeDocument(doc map[string]string) []byte {

	encBuf := new(bytes.Buffer)
	encoder := gob.NewEncoder(encBuf)
	err := encoder.Encode(doc)
	if err != nil {
		log.Printf("Encoder unable to binary encode document for: %#v\n", doc)
	}
	return encBuf.Bytes()

}

// binary encding for messages coming from internal q/store, in nats qs this is
// handled automatically by the use of gob encoder on connection
func DecodeDocument(bytedoc []byte) map[string]string {

	decBuf := bytes.NewBuffer(bytedoc)
	decoder := gob.NewDecoder(decBuf)
	var docOut map[string]string
	err := decoder.Decode(&docOut)
	if err != nil {
		log.Println("Error decoding document from store:", err)
	}
	return docOut
}

// start the server
func (ows *ODDESSAWebServer) Run() {

	loadCollectionData()
	loadUseCaseDefinitions()

	e := echo.New()

	// static resources
	e.Static("/", "public")

	// homepage
	e.File("/", "public/index.html")
	e.File("/oddessa", "public/index.html")

	// get list of current use cases
	e.Get("/oddessa/usecases", func(c echo.Context) error {
		return c.JSON(http.StatusAccepted, tomlConfig.UseCases)
	})

	// autocomplete search
	e.Get("/oddessa/autocomp/:type", func(c echo.Context) error {

		index := c.Param("type")
		term := c.QueryParam("term")
		// log.Println("\nsearch term is: ", term)
		sr := getSearchResults(index, term)
		return c.JSON(http.StatusAccepted, sr.Labels)
	})

	// search
	e.Get("/oddessa/search/:type", func(c echo.Context) error {

		index := c.Param("type")
		// get the query string
		qterms := strings.Split(c.QueryParam("terms"), ",")
		log.Println("search type:", index)
		log.Printf("%q\n", qterms)

		// run search for each
		// create list of record ids
		keys := make([]string, 0)
		for _, qterm := range qterms {
			// further process input to allow for badly formed terms
			term := strings.Trim(qterm, " ,")
			if term != "" {
				sr := getSearchResults(index, term)
				if len(sr.Indexes) > 0 {
					keys = append(keys, sr.Indexes...)
				}
			}
		}
		// log.Println("indexes:", keys)

		// retrieve content fields into struct
		// return structs array to browser as json
		results := make([]SearchResultContent, 0)
		for _, key := range keys {
			// get the full document
			bytedoc, err := db_engine.Get([]byte(key))
			if err != nil {
				return err
			}
			doc := DecodeDocument(bytedoc)
			// log.Printf("document \n%#v\n", doc)
			// assign to content struct to be returned as json
			result := SearchResultContent{
				Collection:      doc["Collection"],
				CollectionFrame: doc["Collection Frame"],
				DataElement:     doc["Data Element"],
				Definition:      doc["Definition"],
				Usage:           doc["Guide for Use"],
				SIFElement:      doc["SIF Element"],
				SIFObject:       doc["SIF Object"],
				DocID:           key,
			}
			results = append(results, result)
		}

		return c.JSON(http.StatusAccepted, results)
	})

	// get the full content for a given data element id
	e.Get("/oddessa/document/:docid", func(c echo.Context) error {

		docid := c.Param("docid")

		// retrieve doc from datastore
		bytedoc, err := db_engine.Get([]byte(docid))
		if err != nil {
			return err
		}
		doc := DecodeDocument(bytedoc)

		return c.JSON(http.StatusAccepted, doc)
	})

	// configure & launch the webserver
	e.Use(mw.Logger())
	e.Use(mw.Recover())
	log.Println("Starting web-ui services...")
	log.Println("Service is listening on localhost:1326")

	e.Run(fasthttp.New(":1326"))

}
