var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var sqlite = require('sqlite3').verbose();
var db = new sqlite.Database('homeautomation.db');
var schedule = require('node-schedule');
var moment = require('moment');
var usernames = {};
var five = require("johnny-five"),
    board, shiftRegister, button, temperature, pagar, pagar_gerak;
moment().format();
server.listen(80);
board = new five.Board();

board.on("ready", function() {
  shiftRegister = new five.ShiftRegister({
    pins: {
      data: 2,
      clock: 3,
      latch: 8
    }
  });
  button = new five.Button(13);
  temperature = new five.Temperature({
    controller: "LM35",
    pin: "A0", 
    readOne : true,
    freq: 1000

  });
  pagar = new five.Stepper({
    type: five.Stepper.TYPE.DRIVER,
    stepsPerRev: 200,
    pins: {
      step: 5,
      dir: 4
    }
  });
  this.repl.inject({
    sr: shiftRegister,
     button: button
  });
  shift_controll();

});
db.serialize(function() {    
	db.each("SELECT * FROM shift_data", function(err, rows) {
        if (!err) {
            console.log(rows);
        }
    })
});

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/content/index.html');
  console.log('dipanggil');
});

io.on('connection', function (socket) {

  var addedUser = false;
  socket.on('tombol', function (data) {
    console.log(data);   
    socket.broadcast.emit('tombol', data);
    socket.emit('tombol', data);
  });
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    addedUser = true;
    socket.emit('login', {
      numUsers: 1
    });
    console.log("login" + socket.username);
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: 1
    });
  });
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: 1
      });
    }
  });
  socket.on('speech_command', function (data) {
  	var call_back = speech_comand(data);
  	console.log(call_back);
  	if (call_back != false) {
  		console.log(socket.username);
  		if (moment(call_back[2]).isValid() && call_back[2]!=0) schedule_crons(call_back);
  		else if (call_back[1]=='pagar' || call_back[1]=='gerbang') pagar_command(call_back);

  		/*else if(call_back[0]=="suhu_ruangan"){
  			var suhu ;
  			var i = 1;
  			temperature.on("data", function(err, data) {
    			if (i==1){
    				console.log(Math.round(data.celsius));
    				socket.emit('speech_command', {username : socket.username, message : 'Suhu ruangan saat ini '+Math.round(data.celsius)});
    			}
    			i++;
    			//suhu = data;
  			});
  			//socket.emit('speech_command', {username : socket.username, message : 'Suhu ruangan saat ini '+suhu});
  			console.log(suhu + "asdasd");
  		}*/
  		else{
  			if (call_back[1]=='pintu'){
  				call_back[0] = Number(!call_back[0]);  			
  			}
  			update_shift(call_back);
  		}
  		//var pesan = (call_back)
  		socket.broadcast.emit('speech_command', {type : 'user_command',username : socket.username, message : "Me"+data, judul : socket.username+', ' + "Me"+data});  	 	
  	} else{
  		socket.emit('speech_command', {type : 'command_fail',username : socket.username, message : socket.username+ ' : Perintah tidak Tersedia', judul : "Perintah tidak Tersedia"});
  	}  	    
  });
  if(board.isReady){
  	console.log("teady");
  	button.on("hold", function() {
    	console.log("hold");
    	socket.broadcast.emit('speech_command', {type : 'bell', username : "", message : 'Ada Tamu Datang', judul : "Bell Ditekan"});	
  });
  	/*temperature.on("data", function(err, data) {
    console.log("celsius: %d", data.celsius);
    console.log("fahrenheit: %d", data.fahrenheit);
    console.log("kelvin: %d", data.kelvin);
  });*/
  }
});
function pagar_command (param) {
	if (param[1]=='gerbang') param[1]='pagar';
	
            db.each("SELECT status FROM engine_data WHERE name = ?",[param[1]], function(err, rows) {
			if (!err) {
				if (param[0]!=rows.status) {
					if (pagar_gerak!=true) {
					db.run("UPDATE engine_data SET status=$status WHERE name = $name", {$status: param[0], $name : param[1]}, function(err){
				        if(err) {
				            console.log(err);
				        }else 
				        {
							
								if (rows.status==1) {
								pagar_gerak=true;
								pagar.rpm(65).cw().accel(1600).decel(1600).step(300, function() {
						      		pagar_gerak=false;
						      		console.log("Gerak");
						    	});
								} else{
									pagar_gerak=true;
									pagar.rpm(65).ccw().accel(1600).decel(1600).step(300, function() {
							      		pagar_gerak=false;
							      		console.log("Gerak");
							      	});
								}
							
									
						}
				});
			}
		}
        }
		    });
    
	console.log(param);
	console.log("agar");
}
function update_shift (param_shift) {
	if (param_shift[1]=="semua lampu") {
		console.log("asa");
		db.run("UPDATE shift_data SET status=$status WHERE name LIKE '%lampu%'", {$status: param_shift[0]}, function(err){
		        if(err) {
		            console.log(err);
		        } else {
		            shift_controll(); 
		        }
		    });
	}else{
		db.run("UPDATE shift_data SET status=$status WHERE name = $name", {$status: param_shift[0], $name: param_shift[1]}, function(err){
		console.log("ga semua lampu");
		        if(err) {
		            console.log(err);
		        } else {
		            //console.log('UPDATE DATA');
		            shift_controll(); 
		        }
		    });
	}
}
function speech_comand (data) {
	console.log(data);
	var spt = data.split(' ');
	//console.log(spt[0]);
	var spt_lenght = spt.lenght;
	var call_back = [0,'',0,false];
	var schedule;
	if (spt.length >= 2) {
		if (spt[0]=='hidupkan' || spt[0]=='nyalakan' ||  spt[0]=='buka') call_back[0] = 1;
		else if (spt[0]=='suhu' && spt[1]=='ruangan') call_back[0] = "suhu_ruangan";
		else if(spt[0]=='matikan' || spt[0]=='tutup' || spt[0]=='kunci') call_back[0] = 0;
		else call_back = false;		
		if (spt.lastIndexOf("untuk") !=-1 || spt.lastIndexOf("selama") !=-1 || spt.lastIndexOf("dalam") !=-1) {				
			var param_waktu;
			if (spt.lastIndexOf("untuk")!=-1) param_waktu = spt.lastIndexOf("untuk");
			else if (spt.lastIndexOf("selama")!=-1){
				param_waktu = spt.lastIndexOf("selama");
				var waktu_sch = new Array();
				call_back[3] = 1;
				if(spt.lastIndexOf("jam")!=-1) waktu_sch.push({hours : parseInt(spt[spt.lastIndexOf("jam")-1])});
				if(spt.lastIndexOf("menit")!=-1) waktu_sch.push({minutes : parseInt(spt[spt.lastIndexOf("menit")-1])});
				if(spt.lastIndexOf("detik")!=-1) waktu_sch.push({seconds : parseInt(spt[spt.lastIndexOf("detik")-1])});
				console.log(waktu_sch[0]);
				schedule = moment().add(waktu_sch[0]).format("YYYY-MM-DD HH:mm:ss");	
				call_back[2] = schedule;
			}
			else if (spt.lastIndexOf("dalam")!=-1) param_waktu = spt.lastIndexOf("dalam");
			for (var i = 1; i < param_waktu; i++) {
				//console.log(spt[i]);
				call_back[1] += spt[i]+(spt[i]==spt[param_waktu-1] ? '' : ' ');
			}
		}else if (spt.lastIndexOf("pada") !=-1){
			var param_waktu = spt.lastIndexOf("pada");
			var jam, menit;
			if (spt[param_waktu]+spt[param_waktu+1]=="padajam"){
				if (spt[param_waktu+2]=='satu') spt[param_waktu+2]==1;
				jam = parseInt(spt[param_waktu+2]);
				if (typeof spt[param_waktu+3] != "undefined"){
					menit = parseInt(spt[param_waktu+3]);
					schedule = moment().set({'hours' : jam, 'minutes' : menit}).format("YYYY-MM-DD HH:mm:ss");					
				}else{
					console.log("jam jam");
					console.log(jam);
					schedule = moment().set({'hours' : jam}).format("YYYY-MM-DD HH:mm:ss");
				}
				call_back[2] = schedule;
				console.log(schedule);				
			}else if (spt[param_waktu]=="pada" && typeof spt[param_waktu+1]!="undefined"){
				var waktu = spt[param_waktu+1].split('.');				
				jam = parseInt(waktu[0]);
				menit = parseInt(waktu[1]);
				schedule = moment().set({'hours' : jam, 'minutes' : menit}).format("YYYY-MM-DD HH:mm:ss");									
				console.log(schedule);				
				call_back[2] = schedule;				
			}
			for (var i = 1; i < param_waktu; i++) {
				call_back[1] += spt[i]+(spt[i]==spt[param_waktu-1] ? '' : ' ');
			}
		}
		else{
			for (var i = 1; i < spt.length; i++) {
				//console.log(spt[i]);
				call_back[1] += spt[i]+(spt[i]==spt[spt.length-1] ? '' : ' ');
			}
		}
	}		
	else{
		console.log("Perintah ditolak");
		call_back = false;
	}
	return call_back;
}
function shift_controll () {	
var val_shift = 0;
db.each("SELECT (SELECT sum(value) FROM shift_data WHERE status = ? AND shift_number = ?) as shift1, (SELECT sum(value) FROM shift_data WHERE status = ? AND shift_number = ?) as shift2",[1,1,1,2], function(err, rows) {
	if (!err) {
		console.log(rows);
		shiftRegister.send(rows.shift2, rows.shift1);
	}
    });
}
function schedule_crons (param_insert) {
	if (typeof param_insert != "undefined"){
		var code_schedule;
		if(param_insert[3]==1) update_shift([param_insert[0], param_insert[1]]); param_insert[0]=(param_insert[0]==1 ? 0 : 1)
		code_schedule = param_insert[0]+'/'+param_insert[1];
		db.run("INSERT INTO schedule (schedule_code, schedule_date) VALUES(?,?)", [code_schedule, param_insert[2]], function (err) {
			if (!err) {

			}
		});
	}
	db.each("SELECT * FROM schedule", function(err, rows) {
		if (!err) {
			var schedule_code = rows.schedule_code.split('/');
            schedule.scheduleJob(rows.schedule_date, function(){
			    update_shift([schedule_code[0], schedule_code[1]]);
			});
        }
    });
}
