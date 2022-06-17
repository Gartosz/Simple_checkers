var http = require('http');
var fs = require('fs');
var socket = require('socket.io');
var html = fs.readFileSync("index.html");

//create a server object
var server=http.createServer(function (req, res) { // function to handle request
  res.write(html)
  res.end(); //end the response
}) 

var io = socket(server);
var id = 0;
var turn = 0;
var fields = [[],[]];
var connected_ids = [];
var count = 0;

io.on('connection', function(socket) {

  socket.id=id++;
  count++;

  socket.emit("id", JSON.stringify({id:socket.id,pionki:fields}));

  socket.on('nick', function(nick) {
    let s = "Witaj "+nick+"!";
    if(socket.id<2)
      s += "\nTwoje pionki są koloru " + {0:"białego",1:"czarnego"}[socket.id];
    else
      s += "\nDwóch graczy jest już połączonych. Możesz tylko obserwować rozgrywkę :)";
    socket.emit('chat message', s); 
  })

  socket.on('indexes', function(array){
    fields = array;
  })

  socket.on("new game", function(data){
    if(data == "start new")
    {
      turn = 0;
      socket.broadcast.emit("new game", data);
    }
    else
      socket.broadcast.emit("new game", data?0:1);
  });

  socket.on("choose", function(msg){
    let x=JSON.parse(msg);
    if(id < 2)
    socket.emit("chat message", "Zaczekaj na podłączenie się drugiego gracza");
    else if(x['player']>=2)
      socket.emit("chat message", "Nie jesteś jednym z graczy")
    else if(turn != x['player'])
      socket.emit("chat message", "Nie twoja kolej");
    else if(x['check'])
      socket.emit("choose", x['number']);
    else
      socket.emit("chat message", "To nie jest Twój kolor!");

  });

  socket.on("move", function(data){
    let x = JSON.parse(data);

    if(!x['typ'])
    {
      x['typ'] = (Math.floor(x['ruch']/8)%7)?0:turn?2:1;
      data = JSON.stringify(x);
    }

    function move(){
      turn=(turn+1)%2;
      console.log(fields);
      io.emit("move", data);
    }

    function across(){
      for(let i = 0; i<4; i++)
      {
        let j = x['pionek'];
        let v = [-9,7,-7,9][i];
        let captured = [];
        while(j >=0 && j < 64 && !(i<2 && (((j-v)%8==0 && j!=x['pionek']) || (j%8==0 && j==x['pionek']))) && !(i>=2 && (((j-v)%8==7 && j!=x['pionek']) || (j%8==7 && j==x['pionek']))))
        {
          //console.log(j, x['ruch'], x['pionek'],v)
          //console.log(!(i<2 && (((j-v)%8==0 && j!=x['pionek']) || (j%8==0 && j==x['pionek']))),!(i>=2 && (((j-v)%8==7 && j!=x['pionek']) || (j%8==7 && j==x['pionek']))))
          
          if(x['ruch'] == j)
          {
            x['zbite'] = captured;
            data = JSON.stringify(x);
            return true;
          }
          else if(fields[turn?0:1].includes(j))
            captured.push(j)
          else if(fields[turn].includes(j) && j!=x['pionek'])
            break;
          j += v;
        }
      }
      return false;
    }
    //nie znika pionków i nie dało się wykonać jednego zbicia

    if(x['ruch'] == x['pionek']+7*(turn?1:-1) || x['ruch'] == x['pionek']+9*(turn?1:-1))
    {
      fields[turn][fields[turn].indexOf(x['pionek'])] = x['ruch'];
      move();
    }
      
    else if([14,18].includes(Math.abs(x['ruch']-x['pionek'])) && (x['ruch']-x['pionek'])*(turn?1:-1)>=0 && fields[turn?0:1].includes(x['pionek']+((Math.abs(x['ruch']-x['pionek'])==14?7:9)*(turn?1:-1))))
    {
      fields[turn][fields[turn].indexOf(x['pionek'])] = x['ruch'];
      fields[turn?0:1] = fields[turn?0:1].filter((value) => value != x['ruch']+((turn?1:-1)*(Math.abs(x['ruch']-x['pionek'])==14?7:9)));
      //fields[turn?0:1].splice(fields[turn?0:1].indexOf(x['ruch']+((turn?1:-1)*(Math.abs(x['ruch']-x['pionek'])==14?7:9))),1);
      x['zbite'] = [x['pionek']+((turn?1:-1)*(Math.abs(x['ruch']-x['pionek'])==14?7:9))];
      data = JSON.stringify(x);
      move();
    }
    else if(x['typ'] && across())
    {
      fields[turn][fields[turn].indexOf(x['pionek'])] = x['ruch'];
      fields[turn?0:1] = fields[turn?0:1].filter((value) => !x['zbite'].includes(value));
      move();
    }
    else
      socket.emit("chat message", "Niepoprawny ruch");

    if(fields[turn?0:1].length == 0)
    {
      socket.emit("chat message", "Wygrały "+String(turn?"czarne":"białe")+"!");
    }
  });

  socket.on("disconnect", function(){
    connected_ids = [];
    count--;
    console.log("AAA");
    io.emit("get ids");
  });

  socket.on("return id", function(data){
    connected_ids.push(data);
    
    if(connected_ids.length == count)
    {
      console.log("conn",connected_ids);
      let d = [...Array(Math.max(...connected_ids)+1).keys()].filter((value) => !connected_ids.includes(value));
      console.log(d);
      io.emit("id", d);
    }
  });
  
});

server.listen(8082);