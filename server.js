var express = require('express');
var app = express();
var request = require('request');
var fs = require('fs');
var xmlParser = require('fast-xml-parser');
var LocalStrategy = require('passport-local').Strategy
var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var glob = require('glob');
var passport = require('passport');
var expressSession = require('express-session');

app.use(express.static(__dirname + '/public/html'));
app.set('views', __dirname + '/public/html');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(expressSession({secret: 'mySecretKey', resave: true, saveUninitialized: false}));
app.use(passport.initialize())  
app.use(passport.session());  

var flash = require('connect-flash');
app.use(flash());

// Set paths
app.use('/', express.static('public/html'));
app.use('/js', express.static('public/js'));
app.use('/css', express.static('public/css'));
app.use('/pdf', express.static('public/assets/pdf'));
app.use('/img', express.static('public/assets/images'));
app.use('/logs', express.static('logs'));

// Settings
PORT=8686
inc2doc_file='data/inc2doc_index.json';
dataDir='data/naf/';

var xmlOptions = {
    attributeNamePrefix : "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName : "#text",
    ignoreAttributes : false,
    ignoreNameSpace : false,
    allowBooleanAttributes : false,
    parseNodeValue : false,
    parseAttributeValue : false,
    trimValues: false, // FI: to keep newlines and spaces
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    localeRange: "", //To support non english character in tag/attribute values.
    parseTrueNumberOnly: true,
};



// Files
fs.readFile(inc2doc_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    inc2doc = JSON.parse(data);
});

// =====================================
// ROUTING FUNCTIONS ===================
// =====================================

app.get('/', function(req, res){
    res.sendFile('index.html', {root:'./public/html'});
});

app.get('/dash', isAuthenticated, function(req, res){
    res.render('dash.html', { username: req.user.user });
});

app.get('/annotation', isAuthenticated, function(req, res){
    res.render('annotation.html', { username: req.user.user });
});

// =====================================
// PASSPORT FUNCTIONS ==================
// =====================================

passport.use(new LocalStrategy(
  function(username, password, done) {
    fs.readFile('allowed.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now
        var allowed = JSON.parse(data);
        if (allowed[username] && allowed[username]==password){
            done(null, { user: username });
        }
        else
        {
            done(null, false);
        }
   });
}));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

/* Handle Login POST */
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/' }),
  function(req, res) {
    //res.redirect('/dash');
    //logAction(req.user.user, "LOGIN");
    res.sendStatus(200);
  });

app.get('/logout', function(req, res) {
//    logAction(req.user.user, "LOGOUT");
    req.logout();
    res.redirect('/');
});

// =====================================
// AUTH UTILS ==========================
// =====================================

var isAdmin = function (u){
    return (['piek', 'roxane', 'filip', 'marten'].indexOf(u)>-1);
}

// route middleware to make sure a user is logged in
function isAuthenticated(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}

// =====================================
// QUERY UTILS =========================
// =====================================

function loadNAFFile(nafName, callback){
    var filename=dataDir + nafName + '.naf';
    console.log(filename);
    fs.readFile(filename, 'utf-8', function(err, xmlData) {
        if (err) {
            console.error(err);
        }

        var jsonObj = xmlParser.parse(xmlData, xmlOptions);

        var tokens = jsonObj['NAF']['text']['wf'];
        var ready_title_tokens=[];
        var ready_body_tokens=[]
        for (var i=0; i<tokens.length; i++){
            var token=tokens[i];
            var txt=token['#text'];
            var tid=token['attr']['@_id'];
            var sent=token['attr']['@_sent'];
            var token_data={'text': txt, 'tid': tid, 'sent': sent};
            if (sent=='1') ready_title_tokens.push(token_data);
            else ready_body_tokens.push(token_data);
            if (i==tokens.length-1) callback({'title': ready_title_tokens, 'body': ready_body_tokens});
        }
    });
}

function loadAllNafs(nafs, callback){
    var data=[];
    
    for (var i=0; i<nafs.length; i++){
        loadNAFFile(nafs[i], function(nafData){
            data.push(nafData);
            if (data.length==nafs.length) callback(data);
        });
    }
}

// =====================================
// QUERY ENDPOINTS =====================
// =====================================

app.get('/listincidents', isAuthenticated, function(req, res){
    var difference=Object.keys(inc2doc);
    var intersection = [];
    res.send({'new': Array.from(difference), 'old': Array.from(intersection)});
});

app.get('/loadincident', isAuthenticated, function(req, res){
    if (!req.query['inc']){
        res.sendStatus(400);//("Not OK: incident id not specified");
    } else{
        var incidentId = req.query['inc'];
        var nafs=inc2doc[incidentId];
        loadAllNafs(nafs, function(data){
            res.send({'nafs': data});
        });
    }
});

// =====================================
// START THE SERVER! ===================
// =====================================
    //
app.listen(PORT, function() {
	console.log('started annotation tool nodejs backend on port ' + PORT);
});

module.exports = app;
