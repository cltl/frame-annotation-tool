var express = require('express');
var app = express();
var request = require('request');
var fs = require('fs');
var xmlParser = require('fast-xml-parser');
var jsonParser = require("fast-xml-parser").j2xParser;
var LocalStrategy = require('passport-local').Strategy
var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var glob = require('glob');
var passport = require('passport');
var expressSession = require('express-session');
var mkdirp = require('mkdirp');

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
annotationDir='annotation/'

var xmlOptions = {
    attributeNamePrefix : "",
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
    parseTrueNumberOnly: true
};

var jsonOptions = {
    attributeNamePrefix : "",
    attrNodeName: "attr", //default is false
    textNodeName : "#text",
    ignoreAttributes : false,
    cdataTagName: "__cdata", //default is false
    cdataPositionChar: "\\c",
    format: true,
    indentBy: "",
    supressEmptyNode: true,
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

function loadNAFFile(nafName, adaptJson=true, callback){
    var filename=dataDir + nafName + '.naf';
    console.log(filename);
    fs.readFile(filename, 'utf-8', function(err, xmlData) {
        if (err) {
            console.error(err);
        }

        var jsonObj = xmlParser.parse(xmlData, xmlOptions);

        if (adaptJson){
            var tokens = jsonObj['NAF']['text']['wf'];
            var ready_title_tokens=[];
            var ready_body_tokens=[]
            for (var i=0; i<tokens.length; i++){
                var token=tokens[i];
                var txt=token['#text'];
                var tid=token['attr']['id'];
                var sent=token['attr']['sent'];
                var token_data={'text': txt, 'tid': tid, 'sent': sent};
                if (sent=='1') ready_title_tokens.push(token_data);
                else ready_body_tokens.push(token_data);
                if (i==tokens.length-1) callback({'title': ready_title_tokens, 'body': ready_body_tokens, 'name': nafName});
            }
        } else {
            console.log(JSON.stringify(jsonObj));
            callback(jsonObj);
        }
    });
}

var loadAllNafs = function(nafs, callback){
    var data=[];
    
    for (var i=0; i<nafs.length; i++){
        loadNAFFile(nafs[i], adaptJson=true, function(nafData){
            data.push(nafData);
            if (data.length==nafs.length) callback(data);
        });
    }
}

// TODO: Implement this function
var addAnnotationsToJson = function(jsonData, annotations){
    if (annotations['anntype']=='idiom'){  
        return jsonData;
    } else{ // FEE
        var frame = annotations['frame'];
        var tids = annotations['mentions'];
        if (!('srl' in jsonData)){
            jsonData['srl']={};
            jsonData['srl']['#text']='';
            jsonData['srl']['predicate']=[];
            var pr_id="pr1";
        } else {
            var pr_num=jsonData['srl'].length + 1;
            var pr_id="pr" + pr_num;
        }
        var aPredicate = {};
        aPredicate['#text']='';
        aPredicate['attr']={};
        aPredicate['attr']['id']=pr_id;
        aPredicate['externalReferences']={'#text': '', 'externalRef': []};
        aPredicate['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': frame, 'resource': 'FrameNet'}});
        aPredicate['span']={'#text': '', 'target': []};
        for (var i=0; i<tids.length; i++){
            var tid=tids[i].split('.')[1];
            aPredicate['span']['target'].push({'#text': '', 'attr':{'id': tid}});
        }
        jsonData['srl']['predicate'].push(aPredicate);
        return jsonData;
    }
}

var saveNAFAnnotation = function(userAnnotationFile, updatedJson, callback){
    var parser = new jsonParser(jsonOptions);
    var xml = parser.parse(updatedJson);
    fs.writeFile(userAnnotationFile, xml, function(err, data) {
        if (err) {
            console.log(err);
        }
        else {
            console.log('updated!');
            callback(false);
        }
  });
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

app.post('/storeannotations', isAuthenticated, function(req, res){
    var thisUser=req.user.user;
    console.log("Storing request received from " + thisUser);
    if (req.body.incident){
	    var annotations = req.body.annotations || {};
        var firstMention=annotations['mentions'][0];
        console.log(firstMention);
        var docidAndTid = firstMention.split('.');
        var docId=docidAndTid[0].replace(/_/g, " ");;
        loadNAFFile(docId, adaptJson=false, function(nafData){
            var userAnnotationDir=annotationDir + thisUser + "/";

            var langAndTitle=docId.split('/');
            var lang=langAndTitle[0];
            var title=langAndTitle[1];

            var userAnnotationDirLang = userAnnotationDir + lang + '/';

            mkdirp(userAnnotationDirLang, function (err) {
                if (err) console.error(err)
                else console.log('pow!')
            });

            var userAnnotationFile=userAnnotationDirLang + title + '.naf';
            console.log('File ' + docId + ' loaded. Now updating and saving.');
            var updatedJson = addAnnotationsToJson(nafData, annotations);

            saveNAFAnnotation(userAnnotationFile, updatedJson, function(error){
                console.log('Error obtained with saving: ' + error);
                if (error){
                    res.sendStatus(400);
                } else {
                    res.sendStatus(200);
                }
            });
        });
    } else {
        console.error("Storing of annotations: incident not specified - user " + thisUser);
        res.sendStatus(400);//("Not OK: incident id not specified");
    }
});

app.get('/getstrdata', isAuthenticated, function(req, res){
    var inc = req.query['inc'];
    var jsonResult={'time': 'yesterday', 'location': 'Marseille'};
    res.send(jsonResult);
});

// =====================================
// START THE SERVER! ===================
// =====================================
    //
app.listen(PORT, function() {
	console.log('started annotation tool nodejs backend on port ' + PORT);
});

module.exports = app;
