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
var _ = require('underscore');

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
GUIDELINESVERSION='v1'
PORT=8787
inc2doc_file='data/json/inc2doc_index.json';
inc2str_file='data/json/inc2str_index.json';
type2inc_file='data/json/type2inc_index.json';
proj2inc_file='data/json/proj2inc_index.json';

likely_frames_file='data/frames/dominant_frame_info.json';
frame_info_file='data/frames/frame_to_info.json';

dataDir='data/naf/';

annotationDir='annotation/'

customRefs={};

var xmlOptions = {
    attributeNamePrefix : "",
    attrNodeName: "attr", //default is 'false'
    textNodeName : "#text",
    ignoreAttributes : false,
    ignoreNameSpace : false,
    allowBooleanAttributes : false,
    parseNodeValue : false,
    parseAttributeValue : false,
    trimValues: true, // FI: to trim newlines and spaces (these are preserved with CDATA)
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

fs.readFile(proj2inc_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    proj2inc = JSON.parse(data);
});

fs.readFile(type2inc_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    type2inc = JSON.parse(data);
});

fs.readFile(likely_frames_file, 'utf8', function (err, data){
    if (err) throw err; // we'll not consider error handling for now
    allFrames = JSON.parse(data);
});

fs.readFile(frame_info_file, 'utf8', function (err, data){
    if (err) throw err; // we'll not consider error handling for now
    allFramesInfo = JSON.parse(data);
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
    req.session.visited = new Date().toISOString().replace(/\..+/, '');
    var userAnnotationDir = annotationDir + req.user.user + "/";

    mkdirp(userAnnotationDir, function (err) {
        if (err) console.error('Error with creating a directory' + err);
        else {
            var refFilePath = userAnnotationDir + 'customrefs.json';
            fs.closeSync(fs.openSync(refFilePath, 'a'));
        }
    });

    res.sendStatus(200);
});
 
app.get('/logout', function(req, res) {
    req.session.destroy();

    req.logout();
    res.redirect('/');
});

// =====================================
// AUTH UTILS ==========================
// =====================================

var isAdmin = function (u){
    return (['piek', 'filip', 'marten'].indexOf(u)>-1);
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

var sortObjectsByKey = function(objects, key) {
    return objects.sort(function(a, b) {
        var a_key = a[key];
        var b_key = b[key];
        return ((a_key < b_key) ? -1 : ((a_key > b_key) ? 1 : 0));
    });
}

var getTokenData = function(tokens){
    var tokenData = {};

    for (var i = 0; i < tokens.length; i++){
        var token = tokens[i];
        var tid = token['attr']['id'];
        var sent = token['attr']['sent'];
        tokenData[tid] = {'sent': sent, 'text': token['__cdata']};
    }

    return tokenData;
}

var getRoleData = function(roles, callback){
    var result = {};
    
    if (!(Array.isArray(roles))) roles = [roles];
    if (!roles || roles.length == 0) callback(result);

    else{
        for (var role_i = 0; role_i < roles.length; role_i++) {
            console.log(role_i);
            var role=roles[role_i];
            console.log(JSON.stringify(role));
            var roleId=role["attr"]["id"]; 
            var targets=role['span']['target'];
            if (!(Array.isArray(targets))) targets=[targets];
            console.log(JSON.stringify(targets));
            for (var j=0; j<targets.length; j++){
                var tid=targets[j]['attr']['id'];
                console.log(tid);
                result[tid]=roleId;
                console.log('result' + JSON.stringify(result));
                if (j==targets.length-1 && role_i==roles.length-1){
                    callback(result);
                }
            }

            /*getMostRecentAnnotations(role['externalReferences']['externalRef'], function(rawRoleType, roleRefer){
                var roleType=rawRoleType.split('@')[1];
                var targets=role['span']['target'];
                if (!(Array.isArray(targets))) targets=[targets];
                console.log(JSON.stringify(targets));
                for (var j=0; j<targets.length; j++){
                    var tid=targets[j]['attr']['id'];
                    result[tid]=roleId;
                    if (j==targets.length-1 && role_i==roles.length-1){
                        callback(result);
                    }
                }
            }); */
        }
    }
}

// Get the roles of an annotated frame
// Parameters: object, string, callback
var getAnnotatedRolesForPredicate = function(jsonObj, the_id, callback) {
    var srl_data = [];

    // Get SRL layer
    if (jsonObj['NAF']['srl'])
        srl_data = jsonObj['NAF']['srl']['predicate'];

    // Return empty if SRL layer is empty
    if (!srl_data || srl_data.length == 0) {
        callback({});
    } else {
        if (!(Array.isArray(srl_data))) srl_data = [srl_data];

        // Find predicate in SRL where pr_id == the_id
        for (var i = 0; i < srl_data.length; i++){
            var pr = srl_data[i];
            var pr_id = pr['attr']['id'];

            if (pr_id == the_id){
                var roles = pr['role'];
                
                if (!roles) {
                    callback({});
                } else {
                    getRoleData(roles, function(result){
                        callback(result);
                    });
                }
            } 
        }    
    }
}

// Check if date b is more recent than date a
var moreRecent = function(date_a, date_b) {
    if (!date_a)
        return true;
    else
        return new Date(date_a) <= new Date(date_b);
}

// Deprecate predicates with terms in span overlapping terms in provided span
// Parameters: object, string, array, callback
var deprecatePredicateSpanOverlap = function(srl, predicate_id, span) {
    if (!Array.isArray(srl['predicate']) || srl['predicate'].length === 0) return srl;
    if (!Array.isArray(span)) span = [span];

    var predicates = srl['predicate']

    // Iterate trough all terms in span
    for (i = 0; i < span.length; ++i) {
        var current_term_id = span[i]['attr']['id'];

        // Iterate trough all predicates in SRL layer
        for (j = 0; j < predicates.length; j++) {
            var current_predicate = predicates[j];
            var current_predicate_id = current_predicate['attr']['id'];
            
            // Skip predicate itself
            if (current_predicate_id !== predicate_id) {
                var current_predicate_span = current_predicate['span']['target'];

                if (!Array.isArray(current_predicate_span)) current_predicate_span = [current_predicate_span];

                // Iterate trough current predicate span
                for (k = 0; k < current_predicate_span.length; k++) {
                    var current_term_id_in_predicate = current_predicate_span[k]['attr']['id'];

                    // Overlap found!
                    if (current_term_id_in_predicate === current_term_id) {
                        predicates[j]['attr']['human_annotation'] = false;
                        break;
                    }
                }
            }
        }
    }

    srl['predicate'] = predicates;
    return srl;
}

// Get a the type and referents of the most recent annotation of a predicate
// Parameters: array, callback
var getMostRecentAnnotations = function(ext_refs, callback) {
    var type = '';
    var refers = [];

    if (ext_refs) {
        if (!(Array.isArray(ext_refs))) {
            type = ext_refs['attr']['reference'];
            callback(type, refers);
        } else {
            var most_recent_stamp = null;
            var referenceRels = {};

            // Check each annotation (external ref)
            for (var e = 0; e < ext_refs.length; e++) {
                var ext_ref = ext_refs[e];
                var ext_ref_type = ext_ref['attr']['reftype'];
                var ext_ref_stamp = ext_ref['attr']['timestamp'];
                var ext_ref_referent = ext_ref['attr']['reference'];

                // Frame annotation
                if (ext_ref_type === 'type') {
                    if (moreRecent(most_recent_stamp, ext_ref_stamp)) {
                        type = ext_ref_type;
                        most_recent_stamp = ext_ref_stamp;
                    }
                }
                
                // Reference annotation
                else if (ext_ref_type === 'refer') {
                    // Add reference to array of references
                    if (!referenceRels[ext_ref_stamp]) {
                        referenceRels[ext_ref_stamp] = [ext_ref_referent];
                    } else {
                        referenceRels[ext_ref_stamp].push(ext_ref_referent);
                    }
                }
                
                if (e === ext_refs.length - 1) {
                    if (referenceRels[most_recent_stamp]) {
                        refers = referenceRels[most_recent_stamp];
                    }

                    callback(type, refers);
                }
            }
        }
    } else {
        callback(type, refers);
    }
}

// Get a list of annotaions made in a NAF document given its SRL layer
// Parameters: object, callback
var prepareAnnotations = function(srl, callback){
    var result = {};
    var done_i = 0;

    if (!Array.isArray(srl)) srl = [srl];
    if (!srl || srl.length == 0) callback(result);

    // Iterate trough SRL layer
    for (var i = 0; i < srl.length; i++) {
        var cur_pr = srl[i];
        var cur_pr_id = cur_pr['attr']['id'];
        var cur_pr_annotation = cur_pr['attr']['human_annotation'];
        var cur_pr_refs = cur_pr['externalReferences']['externalRef'];
        var cur_pr_span = cur_pr['span']['target'];

        if (!(Array.isArray(cur_pr_span))) cur_pr_span = [cur_pr_span];

        if (cur_pr_annotation === "true") {
            // Get the most recent annotation for current predicate
            getMostRecentAnnotations(cur_pr_refs, function(type, referents) {
                for (var j = 0; j < cur_pr_span.length; j++) {
                    // Add list entry for current term in predicate span
                    var cur_t_id = cur_pr_span[j]['attr']['id'];
                    var cur_term = {'frametype': type, 'predicate': cur_pr_id, 'referents': referents};

                    result[cur_t_id] = cur_term;

                    // Return if all annotations are checked.
                    if (j + 1 === cur_pr_span.length) {
                        done_i++;

                        if (done_i == srl.length) {
                            callback(result);
                        }
                    }
                }
            });
        } else {
            done_i++;

            if (done_i == srl.length) {
                callback(result);
            }
        }
    }
}

// Get NAF info from JSON object
// Parameters: object, string, callback
var json2info = function(jsonObj, nafName, callback){
    var tokens = jsonObj['NAF']['text']['wf'];
    var tokenData = getTokenData(tokens);

    var terms = jsonObj['NAF']['terms']['term'];
    var srl = [];

    if (jsonObj['NAF']['srl']) {
        srl = jsonObj['NAF']['srl']['predicate'];
    }

    var termData = {};

    var ready_title_terms = [];
    var ready_body_terms = [];

    var wikiTitle = jsonObj['NAF']['nafHeader']['public']['attr']['uri'];
    
    // Iterate trough term layer
    for (var i = 0; i < terms.length; i++){
        var term = terms[i];

        var termId = term['attr']['id'];
        var targets = [term['span']['target']];
        var components = term['component'];

        if (components) {
            for (var c = 0; c < components.length; c++){
                var comp = components[c];
                var compId = comp['attr']['id'];
                var lemma = comp['attr']['lemma'];
                var tokenId = targets[0]['attr']['id'];
                var sent = tokenData[tokenId]['sent'];
                var termData = {'text': lemma, 'tid': compId, 'sent': sent};

                if (sent == '1') {
                    ready_title_terms.push(termData);
                }

                else ready_body_terms.push(termData);
            }
        }
        
        else {
            var termTokens = [];
            for (var t = 0; t < targets.length; t++){
                var target = targets[t];
                var targetId = target['attr']['id'];
                var targetInfo = tokenData[targetId];
                var sent = targetInfo['sent'];
                termTokens.push(targetInfo['text']);
            }

            var termData = {'text': termTokens.join(' '), 'tid': termId, 'sent': sent};
            
            if (sent == '1') {
                ready_title_terms.push(termData);
            } else {
                ready_body_terms.push(termData);
            }
        }

        if (i == terms.length - 1){
            console.log(i + ' is at the end. Prepare annotations for ' + nafName + '. Srl:');

            prepareAnnotations(srl, function(ready_srl) {
                console.log('All annotations ready');
                callback({'title': ready_title_terms, 'body': ready_body_terms, 'name': nafName, 'annotations': ready_srl, 'source': wikiTitle, 'sourcetype': wikiTitle.includes('wikipedia') ? "secondary" : "primary"});
            });
        }
    }
}

// Load a NAF file and return JSON
// Parameters: string, string, bool, callback
function loadNAFFile(nafName, theUser, adaptJson, callback){
    var filename = annotationDir + theUser + '/' + nafName + '.naf';

    if (!(fs.existsSync(filename))){
        var filename = dataDir + nafName + '.naf';
    }

    fs.readFile(filename, 'utf-8', function(err, xmlData) {
        if (err) {
            console.error(err);
        }
        
        // Parse xml to JSON
        var jsonObj = xmlParser.parse(xmlData, xmlOptions);

        if (adaptJson) {
            json2info(jsonObj, nafName, function(info){
                callback(info);
            });
        } else {
            callback(jsonObj);
        }
    });
}

// Load multiple NAFs
var loadMultipleNafs = function(nafs, theUser, callback){
    var data = [];

    // Load each NAF file and return if all files are loaded
    for (var i = 0; i < nafs.length; i++) {
        loadNAFFile(nafs[i], theUser, true, function(nafData) {

            data.push(nafData);
            if (data.length == nafs.length) {
                callback(data);
            }
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

var saveSessionInfo = function(jsonData, sessionId, annotator, loginTime){
    var actionTime=new Date().toISOString().replace(/\..+/, '');
    var nafHeaders=jsonData['NAF']['nafHeader'];
    var lps=nafHeaders['linguisticProcessors'];
    for (var l=0; l<lps.length; l++){
        var lp=lps[l];
        if (lp['attr']['layer']=='srl'){ // SRL layer exists
            if (!(Array.isArray(lp['lp']))) var processes=[lp['lp']];
            else var processes=lp['lp'];

            for (var p=0; p<processes.length; p++){
                var process=processes[p];
                var processId=process['attr']['id'];
                if (processId==sessionId){ // session exists -> update it
                    process['attr']['endTimestamp']=actionTime;
                    return jsonData;
                } else if (p==processes.length-1){ // we don't have this session yet -> store it
                    var currentProcess={'attr': {'beginTimestamp': loginTime, 'endTimestamp': actionTime, 'name': 'annotator_' + annotator, 'version': 'guidelines_' + GUIDELINESVERSION, 'id': sessionId}};
                    processes.push(currentProcess);
                    lp['lp']=processes;
                    return jsonData;
                }
            }
        } else if (l==lps.length-1){
            var processes=[];
            srl_lp={'attr': {'layer': 'srl'}};
            lps.push(srl_lp);
            var currentProcess={'attr': {'beginTimestamp': loginTime, 'endTimestamp': actionTime, 'name': 'annotator_' + annotator, 'version': 'guidelines_' + GUIDELINESVERSION, 'id': sessionId}};
            processes.push(currentProcess);
            srl_lp['lp']=processes;
            return jsonData;
        }
    }
}

// Add external references layer to JSON predicate object
// Parameters: object, string, string, string, string
var addExternalRefs = function(aPredicate, frame, sessionId, reltype, timestamp) {
    externalRefs = aPredicate['externalReferences']['externalRef']
    if (!Array.isArray(externalRefs)) externalRefs = [externalRefs]; 

    if (frame != 'none')
        externalRefs.push({'#text': '', 'attr': {'reference': frame, 'resource': 'FrameNet', 'source': sessionId, 'reftype': reltype, 'timestamp': timestamp}});
    
    aPredicate['externalReferences']['externalRef'] = externalRefs;
    return aPredicate;
}

// Create JSON object for new predicate
// Parameters: string, string, string, string, list, string
var createNewPredicateEntry = function(pr_id, frame, sessionId, reltype, tids, timestamp) {
    var aPredicate = {};

    aPredicate['#text'] = '';
    aPredicate['attr'] = {};
    aPredicate['attr']['id'] = pr_id;
    aPredicate['attr']['human_annotation'] = true;
    aPredicate['externalReferences'] = {'#text': '', 'externalRef': []};

    var aPredicate = addExternalRefs(aPredicate, frame, sessionId, reltype, timestamp);

    aPredicate['span'] = makeSpanLayer(aPredicate, tids);
    aPredicate['role'] = [];

    return aPredicate;
}

var createNewRoleEntry=function(rl_id, semRole, sessionId, referents, mentions, timestamp){
    var aRole = {};
    aRole['#text'] = '';
    aRole['attr'] = {}
    aRole['attr']['id'] = rl_id;
    aRole['span'] = makeSpanLayer(aRole, mentions);
    aRole['externalReferences'] = {'#text': '', 'externalRef': []};
    aRole['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': semRole, 'resource': 'FrameNet', 'source': sessionId, 'reftype': 'type', 'timestamp': timestamp}});
//    aRole['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': semRole.split('@')[0], 'resource': 'FrameNet', 'source': sessionId, 'reftype': 'evoke'}});
    if (referents && referents.length>0){
        referents.forEach(function(ref){
            aRole['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': ref, 'resource': 'Wikidata', 'source': sessionId, 'reftype': 'refer', 'timestamp': timestamp}});
        });
    }
    return aRole;
}

// Annotate selected terms with a frame in JSON object
// Parameters: object, object, string
var annotateFrame = function(jsonData, annotations, sessionId){
    var frame = annotations['frame'];
    var reltype = annotations['reltype'];
    var tids = annotations['mentions'];
    var activePredicate = annotations['predicate'];
    var pr_id = "";
    var srl = [];

    // Create SRL layer if not exists
    if (!('srl' in jsonData['NAF'])){
        srl = {}
        srl['#text'] = '';
        srl['predicate'] = [];
        pr_id = "pr1";
    } else {
        srl = jsonData['NAF']['srl'];
        if (!(Array.isArray(srl['predicate']))) srl['predicate'] = [srl['predicate']];

        var predicates = srl['predicate'];

        // Selected term(s) is not yet a predicate
        if (!activePredicate) {
            var pr_num = (parseInt(predicates[predicates.length - 1]['attr']['id'].substring(2)) || 0) + 1;
            var pr_id = "pr" + pr_num;
        }
    }

    var timestamp = new Date().toISOString().replace(/\..+/, '');

    // Create new predicate if selected term(s) is not predicate already
    if (!activePredicate) {
        var new_predicate = createNewPredicateEntry(pr_id, frame, sessionId, reltype, tids, timestamp);
        var new_predicate_span = new_predicate['span']['target'];

        // Check for overlap in predicate spans, and deprecate older versions
        var new_srl = deprecatePredicateSpanOverlap(srl, pr_id, new_predicate_span);
        
        new_srl['predicate'].push(new_predicate);

        jsonData['NAF']['srl'] = new_srl;

        return result = {'prid': pr_id, 'json': jsonData};;
    }

    // Update existing predicate
    else {
        for (var i = 0; i < srl['predicate'].length; i++) {
            var aPredicate = srl['predicate'][i];

            if (aPredicate['attr']['id'] === activePredicate) {
                var aPredicate = addExternalRefs(aPredicate, frame, sessionId, reltype, timestamp);

                srl['predicate'].push(aPredicate);
                jsonData['srl'] = srl;

                return {'prid': activePredicate, 'json': jsonData};
            }
        }
    }
    
}

var addExternalRefsRole=function(aRole, semRole, sessionId, referents, timestamp){
    if (semRole!='none')
        aRole['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': semRole, 'resource': 'FrameNet', 'source': sessionId, 'reftype': 'type', 'timestamp': timestamp}});
    if (referents && referents.length>0){
        referents.forEach(function(ref){
            aRole['externalReferences']['externalRef'].push({'#text': '', 'attr': {'reference': ref, 'resource': 'Wikidata', 'source': sessionId, 'reftype': 'reference', 'timestamp': timestamp}});
        });
    }
    return aRole;
}

var annotateRole=function(jsonData, annotations, sessionId){
    var roleData = annotations;
    var timestamp=new Date().toISOString().replace(/\..+/, '');
    if ('srl' in jsonData['NAF']){
        var predicates=jsonData['NAF']['srl']['predicate'];
        if (!Array.isArray(predicates))
            predicates=[predicates];
        for (var i=0; i<predicates.length; i++){
            if (predicates[i]['attr']['id']==roleData['prid']){
                if (!('role' in predicates[i]))
                    predicates[i]['role']=[];
                else if (!(Array.isArray(predicates[i]['role'])))
                    predicates[i]['role']=[predicates[i]['role']];
                var existingRoles=predicates[i]['role'];
                if (!roleData['rlid']){ // create a new role entry
                    var rl_id='rl' + (existingRoles.length + 1).toString();
                    var aRole=createNewRoleEntry(rl_id, roleData['semRole'], sessionId, roleData['referents'], roleData['mentions'], timestamp);
                    predicates[i]['role'].push(aRole);
                    return {'prid': roleData['prid'], 'json': jsonData};
                } else{ //update existing role entry
                    for (var i=0; i<existingRoles.length; i++){
                        var aRole=existingRoles[i];
                        if (aRole['attr']['id']==roleData['rlid']){
                            var aRole=addExternalRefsRole(aRole, roleData['semRole'], sessionId, roleData['referents'], timestamp);
                            return {'prid': roleData['prid'], 'json': jsonData};
                        }
                    }
                }
            }
        }
    } else{
        return {'prid': roleData['prid'], 'json': jsonData};
    }
}

var addAnnotationsToJson = function(jsonData, annotations, sessionId){
    if (annotations['anntype'] === 'idiom'){  
        return jsonData;
    } else if (annotations['anntype'] === 'fee'){
        return annotateFrame(jsonData, annotations, sessionId);
    } else {
        return annotateRole(jsonData, annotations, sessionId);
    }
}

var saveNAFAnnotation = function(userAnnotationFile, updatedJson, callback){
    var parser = new jsonParser(jsonOptions);
    var xml = parser.parse(updatedJson);
    fs.writeFile(userAnnotationFile, xml, function(err, data) {
        if (err) {
            console.log(err);
            callback(err);
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

// Endpoint to get all projects and its types
app.get('/listprojectsandtypes', isAuthenticated, function(req, res) {
    var projects = Object.keys(proj2inc);
    var types = Object.keys(type2inc);
    res.send({'proj': Array.from(projects), 'types': Array.from(types)});
});

// Endpoint to get all incidents of a certain type in a project
app.get('/listincidents', isAuthenticated, function(req, res) {
    var aType = req.query['mytype'];
    var aProj = req.query['myproj'];
    var incWithDocs = Object.keys(inc2doc);
    var incOfType = Array.from(type2inc[aType]);
    var incOfProj = Array.from(proj2inc[aProj]);
    var selected = _.intersection(incWithDocs, incOfType, incOfProj);
    res.send({'new': Array.from(selected), 'old': []});
});

// Endpoint to load an incident
app.get('/loadincident', isAuthenticated, function(req, res) {
    // Incident ID not provided
    if (!req.query['inc'] || !req.query['etype']){
        res.sendStatus(400); //("Not OK: incident id not specified");
    }
    
    else {
        var incidentId = req.query['inc'];
        var nafs = inc2doc[incidentId];

        loadMultipleNafs(nafs, req.user.user, function(data){
            console.log("All nafs loaded. returning the result now");
            res.send({'nafs': data});
        });
    }
});

app.get('/loadframes', isAuthenticated, function(req, res){
    if (!req.query['eventtype']){
        res.sendStatus(400);
    } else {
        var event_type = req.query['eventtype'];
        var likely_frames = [];
        var candidate_frames = [];
        var pos_candidate_frames = [];
        var other_frames = [];

        Object.keys(allFramesInfo).forEach((cur_frame_premon, index) => {
            var cur_frame_label = allFramesInfo[cur_frame_premon]['frame_label'];
            var cur_frame_def = allFramesInfo[cur_frame_premon]['definition'];
            var cur_frame_framenet = allFramesInfo[cur_frame_premon]['framenet_url'];

            var cur_frame = { 'label': cur_frame_label, 'value': cur_frame_premon, 'definition': cur_frame_def, 'framenet': cur_frame_framenet };
            other_frames.push(cur_frame);
        });

        other_frames = sortObjectsByKey(other_frames);

        res.send({'Likely': likely_frames, 'Candidate': candidate_frames, 'Pos candidate': pos_candidate_frames, 'Other': other_frames});
    }
});

app.get('/allframeroles', isAuthenticated, function(req, res){
    var toReturn={};
    for (var frameId in allFramesInfo){
        var frameInfo = allFramesInfo[frameId];
        var frameLabel=frameInfo['frame_label'];
        var roles=frameInfo['roles'];

        var roleLabels=[];
        for (var i=0; i<roles.length; i++){
            var roleInfo = roles[i];
            var roleLabel=roleInfo['role_label'];
            roleLabels.push(roleLabel);
        }
        toReturn[frameLabel]=roleLabels;
    }
    res.send(toReturn);
});

// Endpoint to get roles of a certain frame
app.get('/getroles', isAuthenticated, function(req, res){
    if (!req.query['docid'] || !req.query['prid']){
        res.sendStatus(400);
    } else {
        var docid = req.query['docid'];

        loadNAFFile(docid, req.user.user, false, function(rawData){
            var the_id = req.query['prid'];

            getAnnotatedRolesForPredicate(rawData, the_id, function(roleData) {
                res.send({"roles": roleData});
            });
        });
    }
});

// Endpoint to store annotations set in request body
app.post('/storeannotations', isAuthenticated, function(req, res){
    var thisUser = req.user.user;
    var loginTime = req.session.visited;

    console.log("Storing request received from " + thisUser);

    // If incident ID provided
    if (req.body.incident) {
        // Get annotation data from request body
	    var annotations = req.body.annotations || {};
        var firstMention = annotations['mentions'][0];
        var docidAndTid = firstMention.split('.');
        var docId = docidAndTid[0].replace(/_/g, " ");

        // Load NAF file using incident info
        loadNAFFile(docId, thisUser, false, function(nafData){
            var userAnnotationDir = annotationDir + thisUser + "/";

            var langAndTitle = docId.split('/');
            var lang = langAndTitle[0];
            var title = langAndTitle[1];

            var userAnnotationDirLang = userAnnotationDir + lang + '/';

            // Make new directory for user and lang if needed
            mkdirp(userAnnotationDirLang, function (err) {
                if (err) {
                    console.error('Error with creating a directory:\n' + err);
                } else {
                    var userAnnotationFile = userAnnotationDirLang + title + '.naf';
                    console.log('File ' + docId + ' loaded. Now updating and saving.');

                    var newData = addAnnotationsToJson(nafData, annotations, req.sessionID);

                    var updatedJson = saveSessionInfo(newData['json'], req.sessionID, thisUser, loginTime);
                    var pr_id = newData['prid'];

                    saveNAFAnnotation(userAnnotationFile, updatedJson, function(error) {
                        if (error) {
                            console.log('Error obtained with saving: ' + error);
                            res.status(400).json({'error': error});
                        } else {
                            console.log('Sending response with predicate ID ' + pr_id);
                            res.send({'prid': pr_id, 'docid': docId});
                        }
                    });
                }
            });
        });
    } else {
        console.error("Storing of annotations: incident not specified - user: " + thisUser);
        res.sendStatus(400); //("Not OK: incident id not specified");
    }
});

var getStructuredData = function(u, inc, callback){
    var jsonResult=inc2str[inc];
    var refFilePath=annotationDir + u + '/customrefs.json';
    fs.readFile(refFilePath, 'utf-8', function(err, data){
        data=data.trim();
        if (data && data!=''){
            console.log('string ' + data);
            customRefs=JSON.parse(data);
            if (customRefs[inc])
                jsonResult['user:custom']=customRefs[inc];
        }
        callback(jsonResult);
    });
}

app.get('/getstrdata', isAuthenticated, function(req, res){
    getStructuredData(req.user.user, req.query['inc'], function(data){
        res.send(data);
    });
});

app.post('/addreferent', isAuthenticated, function(req, res){
    var newRef=req.body.newref;
    var inc=req.body.inc;
    var u = req.user.user;

    var newRefLink = inc + '#' + req.sessionID + '#' + newRef;
    var aReferent=newRefLink + '|' + newRef;

    var refFilePath=annotationDir + u + '/customrefs.json';
    fs.readFile(refFilePath, 'utf-8', function(err, data){
        if (err) throw err; // we'll not consider error handling for now
        var customRefs={};
        if (data && data!='')
            customRefs=JSON.parse(data);
        if (customRefs[inc]){
            customRefs[inc].push(aReferent);
            console.log('incident updated', customRefs[inc]);
        } else{
            customRefs[inc]=[aReferent];
            console.log('new incident info added', customRefs[inc]);
        }
        fs.writeFile(refFilePath, JSON.stringify(customRefs), function(err){
            if (err) console.log(err);
            getStructuredData(u, inc, function(newData){
                console.log(newData);
                res.send(newData);
            });
        });
    });
});

// =====================================
// START THE SERVER! ===================
// =====================================
    //
app.listen(PORT, function() {
	console.log('started annotation tool nodejs backend on port ' + PORT);
});

module.exports = app;
