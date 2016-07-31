
if [ -f "nias.pid" ]
then
echo "There is a nias.pid file in place; run stopnias.sh"
exit
fi


./harness & echo $! >> nias.pid

echo "Run the web client (launch browser here):"
echo "http://localhost:1326/oddessa"

