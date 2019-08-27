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
inc2str_file='data/inc2str_index.json';
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

fs.readFile(inc2str_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    inc2str = JSON.parse(data);
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

var getTokenData = function(tokens){
    var tokenData={};
    for (var i=0; i<tokens.length; i++){
        var token=tokens[i];
        var txt=token['#text'];
        var tid=token['attr']['id'];
        var sent=token['attr']['sent'];
        tokenData[tid]={'sent': sent, 'text': txt};
    }
    return tokenData;
}

var prepareAnnotations = function(srl_data, callback){
    var result={};
    if (Array.isArray(srl_data)){
        var done_i=0;
        for (var i=0; i<srl_data.length; i++){
            var pr = srl_data[i];
            var pr_id=pr['attr']['id'];
            var ftype = pr['externalReferences']['externalRef']['attr']['reference'];
            var targets=pr['span']['target'];
            if (!(Array.isArray(targets))) targets=[targets];

            for (var j=0; j<targets.length; j++){
                var tid=targets[j]['attr']['id'];
                var tidEntry = {'frametype': ftype, 'predicate': pr_id};
                result[tid]=tidEntry;
                if (j+1==targets.length){
                    done_i++;
                    if (done_i==srl_data.length) {
                        callback(result);
                    }
                }
            }
        }
    } else{
        var pr = srl_data;
        var pr_id=pr['attr']['id'];
        var ftype = pr['externalReferences']['externalRef']['attr']['reference'];
        var targets=pr['span']['target'];
        for (var j=0; j<targets.length; j++){
            var tid=targets[j]['attr']['id'];
            var tidEntry = {'frametype': ftype, 'predicate': pr_id};
            result[tid]=tidEntry;
        }
        callback(result);
    }
}

function loadNAFFile(nafName, theUser, adaptJson=true, callback){
    var filename=annotationDir + theUser + '/' + nafName + '.naf';
    if (!(fs.existsSync(filename))){
        var filename=dataDir + nafName + '.naf';
    }
    console.log(filename);
    fs.readFile(filename, 'utf-8', function(err, xmlData) {
        if (err) {
            console.error(err);
        }

        var jsonObj = xmlParser.parse(xmlData, xmlOptions);

        if (adaptJson){
            var tokens = jsonObj['NAF']['text']['wf'];
            var tokenData = getTokenData(tokens);

            var terms = jsonObj['NAF']['terms']['term'];
            var srl=[];
            if (jsonObj['NAF']['srl'])
                srl=jsonObj['NAF']['srl']['predicate'];
            var termData = {};

            var ready_title_terms=[];
            var ready_body_terms=[];

            

            for (var i=0; i<terms.length; i++){
                var term=terms[i];

                var termId=term['attr']['id'];

                var targets=[term['span']['target']];
                var components=term['component'];
                if (components){
                    for (var c=0; c<components.length; c++){
                        var comp=components[c];
                        var compId=comp['attr']['id'];
                        var lemma=comp['attr']['lemma'];
                        var tokenId=targets[0]['attr']['id'];
                        var sent=tokenData[tokenId]['sent'];
                        var termData={'text': lemma, 'tid': compId, 'sent': sent}; 
                        if (sent=='1') ready_title_terms.push(termData);
                        else ready_body_terms.push(termData);
                    }
                } else {
                    var termTokens=[];
                    for (var t=0; t<targets.length; t++){
                        var target=targets[t];
                        var targetId=target['attr']['id'];
                        var targetInfo=tokenData[targetId];
                        var sent=targetInfo['sent'];
                        termTokens.push(targetInfo['text']);
                    }
                    var termData={'text': termTokens.join(' '), 'tid': termId, 'sent': sent};
                    if (sent=='1') ready_title_terms.push(termData);
                    else ready_body_terms.push(termData);
                }
                if (i==terms.length-1){
                    prepareAnnotations(srl, function(ready_srl){
                        callback({'title': ready_title_terms, 'body': ready_body_terms, 'name': nafName, 'annotations': ready_srl});
                    });
                }
            }
        } else {
            callback(jsonObj);
        }
    });
}

var loadAllNafs = function(nafs, theUser, callback){
    var data=[];
    
    for (var i=0; i<nafs.length; i++){
        loadNAFFile(nafs[i], theUser, adaptJson=true, function(nafData){
            data.push(nafData);
            if (data.length==nafs.length) callback(data);
        });
    }
}

var makeSpanLayer = function(anObj, tids){
    anObj['span']={'#text': '', 'target': []};
    for (var i=0; i<tids.length; i++){
        var tid=tids[i].split('.')[2];
        anObj['span']['target'].push({'#text': '', 'attr':{'id': tid}});
    }
    return anObj['span'];
}

var removeAnnotationFromJson = function(jsonData, frameId){
    if (!('srl' in jsonData['NAF'])) return jsonData;
    var predicates=jsonData['NAF']['predicate'];
    var newPredicates=[];
    for (var i=0; i<predicates.length; i++){
        var thisPredicate = predicates[i];
        if (thisPredicate['attr']['id']!=frameId)
            newPredicates.push(thisPredicate);
    }
    jsonData['NAF']['predicate']=newPredicates;
    return jsonData;
}

var addAnnotationsToJson = function(jsonData, annotations){
    if (annotations['anntype']=='idiom'){  
        return jsonData;
    } else{ // FEE
        var frame = annotations['frame'];
        var tids = annotations['mentions'];
        var roles = annotations['roles'] || [{'semRole': 'A0', 'targets':['x.y.t3', 'x.y.t4']}]; 
        if (!('srl' in jsonData['NAF'])){
            jsonData['NAF']['srl']={};
            jsonData['NAF']['srl']['#text']='';
            jsonData['NAF']['srl']['predicate']=[];
            var pr_id="pr1";
        } else {
            var pr_num=(jsonData['NAF']['srl']['predicate'].length || 1) + 1;
            var pr_id="pr" + pr_num;
        }
        var aPredicate = {};
        aPredicate['#text']='';
        aPredicate['attr']={};
        aPredicate['attr']['id']=pr_id;
        aPredicate['externalReferences']={'#text': '', 'externalRef': []};
        aPredicate['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': frame, 'resource': 'FrameNet'}});
        aPredicate['span']=makeSpanLayer(aPredicate, tids);
        
        aPredicate['role']=[];
        console.log(roles);
        for (var r=0; r<roles.length; r++){
            var roleData=roles[r];
            var aRole={};
            aRole['#text']='';
            aRole['attr']={}
            aRole['attr']['id']='rl' + (r+1).toString();
            aRole['attr']['semRole']=roleData['semRole'];
            aRole['span']=makeSpanLayer(aRole, roleData['targets']);
            aPredicate['role'].push(aRole);
        }

        var predicates=jsonData['NAF']['srl']['predicate'];
        if (!(Array.isArray(predicates))){
            jsonData['NAF']['srl']['predicate']=[]
            jsonData['NAF']['srl']['predicate'].push(predicates);
        }
        jsonData['NAF']['srl']['predicate'].push(aPredicate);
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
        loadAllNafs(nafs, req.user.user, function(data){
            res.send({'nafs': data});
        });
    }
});

app.post('/removeannotation', isAuthenticated, function(req, res){
    var thisUser=req.user.user;
    console.log("Removing request received from " + thisUser);
    var frameId = req.body.predicate;
    var docId = req.body.docid;
    loadNAFFile(docId, req.user.user, adaptJson=false, function(nafData){
        var userAnnotationDir=annotationDir + thisUser + "/";

        var langAndTitle=docId.split('/');
        var lang=langAndTitle[0];
        var title=langAndTitle[1];

        var userAnnotationDirLang = userAnnotationDir + lang + '/';

        mkdirp(userAnnotationDirLang, function (err) {
            if (err) 
                console.error('Error with creating a directory' + err);
            else {
                var userAnnotationFile=userAnnotationDirLang + title + '.naf';
                console.log('File ' + docId + ' loaded. Now updating and saving.');
                var updatedJson = removeAnnotationFromJson(nafData, frameId);
                saveNAFAnnotation(userAnnotationFile, updatedJson, function(error){
                    console.log('Error obtained with saving: ' + error);
                    if (error){
                        res.sendStatus(400);
                    } else {
                        res.sendStatus(200);
                    }
                });
            }
        });
    });
});

app.post('/storeannotations', isAuthenticated, function(req, res){
    var thisUser=req.user.user;
    console.log("Storing request received from " + thisUser);
    if (req.body.incident){
	    var annotations = req.body.annotations || {};
        var firstMention=annotations['mentions'][0];
        var docidAndTid = firstMention.split('.');
        var docId=docidAndTid[0].replace(/_/g, " ");
        loadNAFFile(docId, req.user.user, adaptJson=false, function(nafData){
            var userAnnotationDir=annotationDir + thisUser + "/";

            var langAndTitle=docId.split('/');
            var lang=langAndTitle[0];
            var title=langAndTitle[1];

            var userAnnotationDirLang = userAnnotationDir + lang + '/';

            mkdirp(userAnnotationDirLang, function (err) {
                if (err) console.error('Error with creating a directory' + err);
                else {
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
    var jsonResult=inc2str[inc];
    //var jsonResult={'time': 'yesterday', 'location': 'Marseille'};
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
