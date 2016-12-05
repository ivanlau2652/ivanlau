// This application uses express as its web server
var express = require('express');
// cfenv provides access to your Cloud Foundry environment
var cfenv = require('cfenv');

var path = require('path');
var http = require('http');
var url  = require('url');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var bodyParser = require('body-parser');
var ObjectId = require('mongodb').ObjectID;
var session = require('cookie-session');
var fileUpload = require('express-fileupload');
var mlab = 'mongodb://381F:ononon99@ds157247.mlab.com:57247/ivannathandb';
var vcap_services = process.env.VCAP_SERVICES;
//var port = process.env.PORT || 8099;


// create a new express server
var app = express();

app.use(session({
  name: 'session',
  keys: ['key1','key2']
}));

if (vcap_services) {
  var env = JSON.parse(vcap_services);
  if (env['mongodb']) {
    mongo = env['mongodb'][0]['credentials'];
    if (mongo.url) {
      conn_str = mongo.url;
    } else {
      console.log("Mongo on Bluemix cannot found");
	  conn_str = mlab;
    }  
  } else {
    conn_str = mlab;
  }
} else {
  conn_str = 'mongodb://381F:ononon99@ds157247.mlab.com:57247/ivannathandb';
}
//conn_str = 'mongodb://381F:ononon99@ds157247.mlab.com:57247/ivannathandb';
console.log("mongoUrl: " + conn_str);

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// serve the files out of ./public as our main files
app.set('view engine', 'ejs');
app.use(fileUpload());
app.use(bodyParser.json());
app.use("/styles",  express.static(__dirname + '/public/stylesheets'));
app.use("/stylesheets",  express.static(__dirname + '/public/stylesheets'));
app.use("/scripts", express.static(__dirname + '/public/javascripts'));
app.use("/images",  express.static(__dirname + '/public/images'));

app.get('/', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
		res.redirect('/read');
	}
});

app.post('/', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}
  //res.sendFile(__dirname + '/public/index.html');
	//res.redirect('/read');
});

app.get('/new', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}
	res.sendFile(__dirname + '/public/new.html');
});

//create restaurant
app.post('/create', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
	console.log("Creating");
	MongoClient.connect(conn_str, function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
	  console.log(req.body.name);
      create(db,req.body.street,req.body.zipcode,req.body.building,req.body.name,req.body.borough,req.body.cuisine,
		req.body.lon,req.body.lat,
        req.files.sampleFile,req,res,function(restaurant, result) {
          db.close();
		  res.render('display',{r:restaurant});
          /*if (result.insertedId != null) {
            res.status(200);
            res.end('Inserted: ' + result.insertedId);
          } else {
            res.status(500);
            res.end(JSON.stringify(result));
          }*/
      });
    });
	}
});

function create(db,street,zipcode,building,name,borough,cuisine,lon,lat,bfile,req,res,callback) {
  var r = {};  // new restaurant to be inserted
	r['address'] = {};
	r.address.street = (street != null) ? street : null;
	r.address.zipcode = (zipcode != null) ? zipcode : null;
	r.address.building = (building != null) ? building : null;
	r.address['coord'] = [];
	r.address.coord.push(lon);
	r.address.coord.push(lat);
	r['borough'] = (borough != null) ? borough : null;
	r['cuisine'] = (cuisine != null) ? cuisine : null;
	r['name'] = (name != null) ? name : null;
	r['restaurant_id'] = null;
	r['userid'] = req.session.userid;
	r['grades'] = [];
	r['data'] = (bfile != null) ? new Buffer(bfile.data).toString('base64') : null;
	//r['data'] = new Buffer(bfile.data).toString('base64');
	r['mimetype'] = (bfile != null) ? bfile.mimetype : null;
  db.collection('restaurants').insertOne(r, function(err,result) {
    //assert.equal(err,null);
    if (err) {
      result = err;
      console.log("insertOne error: " + JSON.stringify(err));
    } else {
      console.log("Inserted _id = " + result.insertedId);
    }
    callback(r, result);
  });
};


//list page
app.get('/read', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
  MongoClient.connect(conn_str, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findNRestaurants(db,req.query,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');
			res.render('list',{r:restaurants, userid:req.session.userid, criteria: JSON.stringify(req.query)});
			//res.end();
		});
	});
	}
});

function findNRestaurants(db,criteria,callback) {
		var restaurants = [];
		db.collection('restaurants').find(criteria,function(err,result) {
			assert.equal(err,null);
			result.each(function(err,doc) {
				if (doc != null) {
					restaurants.push(doc);
				} else {
					callback(restaurants);
				}
			});
		})
}


//display page
app.get('/display', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
  MongoClient.connect(conn_str, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		var objectId = {_id: ObjectId(req.query._id)};
		findNRestaurants(db,objectId,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');
			res.render('display',{r:restaurants[0]});
			//res.end();
		});
	});
	}
});


//change page
app.get('/change', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
	MongoClient.connect(conn_str, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		var objectId = {_id: ObjectId(req.query._id)};
		findNRestaurants(db,objectId,function(restaurants) {
			db.close();
			if(restaurants[0].userid == req.session.userid){
				MongoClient.connect(conn_str, function(err, db) {
					assert.equal(err,null);
					console.log('Connected to MongoDB\n');
					var objectId = {_id: ObjectId(req.query._id)};
					findNRestaurants(db,objectId,function(restaurants) {
						db.close();
						console.log('Disconnected MongoDB\n');
						res.render('change',{r:restaurants[0]});
						//res.end();
					});
				});

			}else{
				res.render('changeError');
			}
			//res.end();
		});
	});
	}
});

app.post('/change', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
  MongoClient.connect(conn_str, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		var objectId = {_id: ObjectId(req.body._id)};
		
		
		changeRestaurants(db, objectId, req.body, req.files.sampleFile, req.session.userid, function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');
			//res.render('display',{r:restaurants[0], userid:req.session.userid, criteria: JSON.stringify(req.query)});
			res.redirect('/display?_id=' + req.body._id);
			//res.end();
		});
		
		
	});
	}
});

 function changeRestaurants(db, objectId, queryAsObject, bfile, userid, callback) {
	 console.log(bfile);
	 if(bfile.data.length != 0 ){
		db.collection('restaurants').update(objectId,
												{$set: {'address.street': queryAsObject.street, 'address.street': queryAsObject.street, 
															'address.building': queryAsObject.building, 'cuisine': queryAsObject.cuisine, 
															'name': queryAsObject.name, 'address.zipcode': queryAsObject.zipcode, 'borough': queryAsObject.borough, 
															'address.coord.0': queryAsObject.lon, 'address.coord.1': queryAsObject.lat, 
															'data': new Buffer(bfile.data).toString('base64'), 'mimetype': bfile.mimetype}
												}, function(err, result) {
			assert.equal(err, null);
			//console.log(result);
			callback(result);
		});
	 }else{
		db.collection('restaurants').update(objectId,
												{$set: {'address.street': queryAsObject.street, 'address.street': queryAsObject.street, 
															'address.building': queryAsObject.building, 'cuisine': queryAsObject.cuisine,  'borough': queryAsObject.borough, 
															'address.coord.0': queryAsObject.lon, 'address.coord.1': queryAsObject.lat, 
															'name': queryAsObject.name, 'address.zipcode': queryAsObject.zipcode}
												}, function(err, result) {
			assert.equal(err, null);
			//console.log(result);
			callback(result);
		});
	 }
}


//rate page
app.get('/rate', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
	
  MongoClient.connect(conn_str, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		var objectId = {_id: ObjectId(req.query._id)};
		findNRestaurants(db,objectId,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');
			res.render('rate',{r:restaurants[0], userid:req.session.userid});
			//res.end();
		});
	});
	}
});

app.post('/rate', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
  MongoClient.connect(conn_str, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		var objectId = {_id: ObjectId(req.query._id)};
		var score = req.body.score;
		
		rateRestaurants(db, objectId, score, req.session.userid, function(checkRated) {
				rateDone(db, objectId, score, req.session.userid, checkRated, function(result2) {
				db.close();
				console.log('Disconnected MongoDB\n');
				if(result2){
					res.redirect('/display?_id=' + req.query._id);
				}else{
					res.render('rated');
				}
			});
			//console.log('Disconnected MongoDB\n');
			//res.render('display',{r:restaurants[0], userid:req.session.userid, criteria: JSON.stringify(req.query)});
			//res.redirect('/display?_id=' + req.query._id);
			//res.end();
			//res.send("done");
		});
		
		//
	});
	}
});

function rateRestaurants(db, objectId, scores, userid, callback) {
	var checkRated = false;
	db.collection('restaurants').findOne(objectId, function(err, result){
				if(err){
					console.log(err);
				}else{
					//db.close();
					if(result){
						result.grades.forEach(function(grade) {
							if(grade.user == userid){
								checkRated = true;
							}
							console.log("user" + grade.user + ", score: " + grade.score);
							console.log(checkRated);
						});
					}
					callback(checkRated);
				}
			});
			
}

function rateDone(db, objectId, scores, userid, checkRated, callback) {
	console.log(checkRated);
			if(checkRated == false){
				db.collection('restaurants').update(objectId,
														{$push: {grades: {user: userid,
														score:scores}
														}
													}, function(err, result) {
					assert.equal(err, null);
					//console.log(result);
					callback(true);
				});
			}else{
				callback(false);
			}
}

//gmap page
app.get('/gmap', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
	res.render('gmap',{lat:req.query.lat, lon:req.query.lon, title:req.query.title});
	}
});


//remove page
app.get('/remove', function (req, res) {
	if(!req.session.userid){
		res.redirect('/login');
	}else{
	MongoClient.connect(conn_str, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		var objectId = {_id: ObjectId(req.query._id)};
		findNRestaurants(db,objectId,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');
			if(restaurants[0].userid == req.session.userid){
				MongoClient.connect(conn_str, function(err, db) {
					assert.equal(err,null);
					console.log('Connected to MongoDB\n');
					var objectId = {_id: ObjectId(req.query._id)};
					db.collection('restaurants').deleteMany(objectId,
						function(err,result) {
							assert.equal(err,null);
							console.log("deleteMany() was successful _id = " +
								JSON.stringify(objectId));
							db.close();
							res.render('remove');
						});
				});	

			}else{
				res.render('removeError');
			}
			//res.end();
		});
	});
	}
});

//Nathan
app.get('/login', function(req, res) {
	res.sendFile(__dirname + '/public/login.html');
});

app.post('/login', function(req, res) {
	//if(!req.session.userid){
		if(!req.body.userid){
			res.send('user ID cannot be blank');
			return;
		}else{
		console.log(req.body.userid + " " + req.body.password);
		var user = req.body.userid;
		var pass = req.body.password;
		MongoClient.connect(conn_str, function(err, db){
			console.log('connecting DB');
			assert.equal(err, null);
			//edit collection here
			db.collection('users').findOne({"userid": user}, function(err, result){
				if(err){
					console.log(err);
					res.send('Login Error');
				}else{
					console.log('result is comming');
					db.close();
					//console.log("DB " + result.userid + " " + result.password);
					if(result != null){
						if(user == result.userid && pass == result.password){
							req.session.userid = result.userid;
							res.redirect('/read');
						}else{
							res.redirect('/login');
						}
					}else{
						res.redirect('/login');
					}
				}
				console.log("..." + req.session.userid);
			});
		});
	/*}else{
		res.redirect('/');
	}*/
	}
});

app.get('/reg', function(req, res) {
	res.sendFile(__dirname + '/public/reg.html');
});

app.post('/reg', function(req, res) {
	if(!req.body.userid || !req.body.password){
		res.send('user ID or password cannot be blank');
		return;
	}
	var user = req.body.userid;
	var pass = req.body.password;
	MongoClient.connect(conn_str, function(err, db){
		console.log('connecting DB');
		assert.equal(err, null);
//edit collection here
		db.collection('users').findOne({"userid": user}, function(err, result){
			console.log('reg db fin');
			console.log(result);
			if(result){
				if(result.userid == user){
					res.end('Account exists');
				}
			}else{
				req.session.userid = user;
				createAC(db, user, pass, function(doc){
					db.close();
					console.log('DB Closed');
					if(doc.insertedId != null){
						//req.session.userid = user;
						console.log("Session " + req.session.userid);
						res.redirect('/');
						//req.redirect('/login');
					}else{
						console.log('created 500');
						res.status(500);
						res.end('Create fail');
						console.log(JSON.stringify(result));
					}
				});
			}
		});
	});
});

app.get('/logout', function(req, res, next){
	req.session = null;
	res.redirect('/');
});

function createAC (db, userid, password, callback) {
	console.log('create state');
	console.log('create ' + userid + " " + password);
//edit collection here
	db.collection('users').insertOne({
		"userid": userid,
		"password": password,
	},function(err, result){
		assert.equal(err, null);
		if(err){
			result = err;
			console.log('error' + JSON.stringify(err));
		}else{
			console.log('Inserted');
		}
		callback(result);
	});
}


//api handler
app.get('/api/:action/:key/:value', function(req, res) {
	var arrayParams = {};
	var action = req.params.action;
	var key = req.params.key;
	var value = req.params.value;
	arrayParams[req.params.key] = value;
	if(action == "read"){
		MongoClient.connect(conn_str, function(err, db) {
			assert.equal(err,null);
			console.log('Connected to MongoDB\n');
			findNRestaurants(db,arrayParams,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');
				res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
				if(restaurants.length > 0){
					res.end(JSON.stringify(restaurants));
				}else{
					res.end(JSON.stringify({}));
				}
			});
		});
	}else if(action == "remove"){
		if(key == "collection"){
			MongoClient.connect(conn_str, function(err, db) {
				assert.equal(err,null);
				console.log('Connected to MongoDB\n');
				removeCollection(db,value,function(numberOfRemove) {
					db.close();
					console.log('Disconnected MongoDB\n');
					res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
					res.end(JSON.stringify(numberOfRemove));
					req.session = null;
				});
			});
		}
	}
});

function removeCollection(db,collection,callback) {
	db.collection(collection).remove({},function(err,result){
		assert.equal(err,null);
		console.log("inside remove call back" + result);
		callback(result);
	});
}

app.post('/api/:action', function(req, res) {
	var arrayParams = {};
	var action = req.params.action;
	var value = req.params.value;
	arrayParams[req.params.key] = value;
	if(action == "create"){
		if(!req.session.userid){
			res.redirect('/login');
		}else{
		console.log('asdasdasd');
		if(req.body.name != null && req.body.name != ""){
			MongoClient.connect(conn_str, function(err,db) {
			  assert.equal(null,err);
			  console.log(req.body.name);
			  if(req.files){
				  create(db,req.body.street,req.body.zipcode,req.body.building,req.body.name,req.body.borough,req.body.cuisine,
					req.body.lon,req.body.lat,
					req.files.sampleFile,req,res,function(restaurant, result) {
					  db.close();
					  console.log(result);
					  if (result) {
						res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
						res.end(JSON.stringify({status: "ok", _id: result.insertedId}));
					  } else {
						res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
						res.end(JSON.stringify({status: "failed"}));
					  }
				  });
			  }else{
				  create(db,req.body.street,req.body.zipcode,req.body.building,req.body.name,req.body.borough,req.body.cuisine,
					req.body.lon,req.body.lat,
					null,req,res,function(restaurant, result) {
					  db.close();
					  console.log(result);
						  console.log("_id: " + result.insertedId);
					  if (result) {
						res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
						res.end(JSON.stringify({status: "ok", _id: result.insertedId}));
					  } else {
						res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
						res.end(JSON.stringify({status: "failed"}));
					  }
				  });
			  }
		});
		}else{
			res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
			res.end(JSON.stringify({status: "failed"}));
		}
		}
	}
});

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
