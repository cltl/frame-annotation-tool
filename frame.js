var express = require('express');
var request = require('request');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressSession = require('express-session');

var fs = require('fs');
var xmlParser = require('fast-xml-parser');
var jsonParser = require("fast-xml-parser").j2xParser;
var morgan       = require('morgan');
var glob = require('glob');
var mkdirp = require('mkdirp');
var _ = require('underscore');

var app = express();

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

const CONTRASTING_COLORS = ['#731d1d', '#ff8080', '#a6877c', '#f2853d', '#402310', '#7f4400', '#e5b073', '#8c7000', '#ffd940', '#eeff00', '#64664d', '#2a4000', '#86b32d', '#d6f2b6', '#20f200', '#00660e', '#7ca692', '#00cc88', '#00e2f2', '#00474d', '#36a3d9', '#397ee6', '#26364d', '#acc3e6', '#2d3eb3', '#1f00e6', '#311659', '#b836d9', '#d5a3d9', '#644d66', '#80206c', '#f200a2'];

// Settings
const GUIDELINESVERSION = 'v1'
const PORT = 8787

const inc2doc_file = 'data/json/inc2doc_index.json';
const inc2str_file = 'data/json/inc2str_index.json';
const type2inc_file = 'data/json/type2inc_index.json';
const proj2inc_file = 'data/json/proj2inc_index.json';

const likely_frames_file = 'data/frames/dominant_frame_info.json';
const frame_info_file = 'data/frames/frame_to_info.json';

const dataDir = 'data/naf/';

const ANNOTATION_DIR = 'annotation/'

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

passport.use(new LocalStrategy(function(username, password, done) {
    fs.readFile('allowed.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now

        var allowed = JSON.parse(data);
        if (allowed[username] && allowed[username] == password) {
            done(null, { user: username });
        } else {
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

app.post('/login', passport.authenticate('local', { failureRedirect: '/' }), function(req, res) {
    req.session.visited = new Date().toISOString().replace(/\..+/, '');
    var user_annotation_dir = ANNOTATION_DIR + req.user.user + "/";

    mkdirp(user_annotation_dir, function (error) {
        if (error) console.error(error);
        else {
            var customrefs_path = user_annotation_dir + 'customrefs.json';
            fs.closeSync(fs.openSync(customrefs_path, 'a'));
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
// HELPER UTILS ========================
// =====================================

/**
 * Returns a sorted array of objects based on the sorting key
 * @param {array}       objects     Array of objects to be sorted
 * @param {string}      key         Key of objects to sort on
 */
var sortObjectsByKey = function(objects, key) {
    return objects.sort(function(a, b) {
        var a_key = a[key];
        var b_key = b[key];
        return ((a_key < b_key) ? -1 : ((a_key > b_key) ? 1 : 0));
    });
}

/**
 * Returns true if date_b is more recent than date_a
 * @param {string}      date_a      First date to check
 * @param {string}      date_b      Second date to check
 */
var moreRecent = function(date_a, date_b) {
    if (!date_a)
        return true;
    else
        return new Date(date_a) <= new Date(date_b);
}

// =====================================
// QUERY UTILS =========================
// =====================================

var getTokenData = function(tokens){
    var result = {};

    for (var i = 0; i < tokens.length; i++){
        var token = tokens[i];
        var tid = token['attr']['id'];
        var sent = token['attr']['sent'];
        result[tid] = {'sent': sent, 'text': token['__cdata']};
    }

    return result;
}

var getMultiWordData = function(terms) {
    var result = {};

    for (var i = 0; i < terms.length; i++){
        var term = terms[i];
        var term_id = term["attr"]["id"];
        var term_type = term["attr"]["phrase_type"]
        var term_components = term["component"];

        if (term_type == "idiom" || term_type == "multi_word") {
            for (var j = 0; j < term_components.length; j++) {
                result[term_components[j]["attr"]["id"]] = term_id;
            }
        }
    }

    return result;
}

var getActiveRoleAnnotation = function(annotation_refs, annotation_span, callback) {
    getMostRecentExternalReference(annotation_refs, function(element_id, referents) {
        callback(element_id, annotation_span);
    });
}

// Get the frame element information for a predicate
// Parameters: object, string, callback
var getRolesForPredicate = function(jsonObj, pr_id, callback) {
    var srl_data = [];

    // Get SRL layer
    if (jsonObj['NAF']['srl']) srl_data = jsonObj['NAF']['srl']['predicate'];

    // Return empty if SRL layer is empty
    if (!srl_data || srl_data.length == 0) {
        callback();
    } else {
        if (!(Array.isArray(srl_data))) srl_data = [srl_data];

        // Find predicate in SRL where pr_id == the_id
        for (var i = 0; i < srl_data.length; i++){
            var cur_pr = srl_data[i];
            var cur_pr_id = cur_pr['attr']['id'];

            if (cur_pr_id == pr_id) {
                getMostRecentExternalReference(cur_pr["externalReferences"]["externalRef"], function(frame_id, referents) {
                    var pr_elements = cur_pr['role'];

                    // Get frame elements frame frame_id
                    getFrameElements(frame_id, function(frame_elements) {
                        var core_elements = frame_elements["Core"];
                        var other_elements = [].concat(frame_elements["Peripheral"], frame_elements["Extra-thematic"], frame_elements["Core-unexpressed"]);
                        
                        // Loop core frame elements
                        if (!pr_elements) {
                            var result = {};
                            for (var j = 0; j < core_elements.length; j++) {
                                var frame_element = core_elements[j];
                                result[frame_element["value"]] = { "label": frame_element["label"], "fe_type": "Core", "target_ids": [], "color": CONTRASTING_COLORS[i], "annotated": false, "expressed": false };
                            }

                            callback(result)
                        } else {
                            if (!Array.isArray(pr_elements)) pr_elements = [pr_elements];

                            var result = {};

                            var annotations = {};
                            for (var j = 0; j < pr_elements.length; j++) {
                                var annotation_refs = pr_elements[j]["externalReferences"]["externalRef"];
                                var annotation_span = pr_elements[j]["span"]["target"];
                                
                                if (pr_elements[j]["span"] != "") {
                                    if (!Array.isArray(annotation_span)) annotation_span = [annotation_span];

                                    for (var l = 0; l < annotation_span.length; l++) {
                                        annotation_span[l] = annotation_span[l]["attr"]["id"];
                                    }
                                } else {
                                    annotation_span = [];
                                }

                                getActiveRoleAnnotation(annotation_refs, annotation_span, function(key, value) {
                                    annotations[key] = value;

                                    if (Object.keys(annotations).length == pr_elements.length) {
                                        var color_index = 0;

                                        // Loop over core elements
                                        for (var k = 0; k < core_elements.length; k++) {
                                            var frame_element = core_elements[k];

                                            var expressed = false;
                                            var annotated = false;
                                            var targets = [];

                                            if (Object.keys(annotations).includes(frame_element["value"])) {
                                                expressed = annotations[frame_element["value"]].length > 0;
                                                targets = annotations[frame_element["value"]];
                                                annotated = true;
                                            }

                                            result[frame_element["value"]] = { "label": frame_element["label"], "fe_type": "Core", "target_ids": targets, "color": CONTRASTING_COLORS[color_index], "annotated": annotated, "expressed": expressed };
                                            color_index++;
                                        }

                                        for (var k = 0; k < other_elements.length; k++) {
                                            var frame_element = other_elements[k];

                                            if (Object.keys(annotations).includes(frame_element["value"])) {
                                                var expressed = annotations[frame_element["value"]].length > 0;
                                                var targets = annotations[frame_element["value"]];

                                                result[frame_element["value"]] = { "label": frame_element["label"], "fe_type": "Other", "target_ids": targets, "color": CONTRASTING_COLORS[color_index], "annotated": true, "expressed": expressed };
                                                color_index++;
                                            }
                                        }

                                        callback(result);
                                    }
                                });
                            }
                        }
                    });
                });
            }
        }    
    }
}

// Get the frame elements for a specific frame type
// Parameters: string, callback
var getFrameElements = function(frame_id, callback) {
    var core_elements = [];
    var peripheral_elements = [];
    var extra_thematic_elements = [];
    var core_unexpressed_elements = [];

    var frame_info = allFramesInfo[frame_id];
    var frame_framenet = frame_info['framenet_url'];
    var frame_elements = frame_info['frame_elements'];

    // Get all frame elements
    for (var i = 0; i < frame_elements.length; i++) {
        var frame_element = frame_elements[i];
        var element_label = frame_element['fe_label'];
        var element_definition = frame_element['definition'];
        var element_type = frame_element['fe_type'];
        var element_premon = frame_element['rdf_uri'];

        var element = { 'label': element_label, 'value': element_premon, 'definition': element_definition, 'framenet': frame_framenet };

        // Add current frame element to correct resulting list
        if (element_type == "Core") core_elements.push(element);
        else if (element_type == "Peripheral") peripheral_elements.push(element);
        else if (element_type == "Extra-thematic") extra_thematic_elements.push(element);
        else if (element_type == "Core-unexpressed") core_unexpressed_elements.push(element);
        else continue
    }

    callback({ "Core": core_elements, "Peripheral": peripheral_elements, "Extra-thematic": extra_thematic_elements, "Core-unexpressed": core_unexpressed_elements });
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
                        predicates[j]['attr']['status'] = "deprecate";
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
var getMostRecentExternalReference = function(ext_refs, callback) {
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

// Get role annotation information for a specific predicate
// Parameters: string, list, callback
var getPredicateRoles = function(pr_id, roles, callback) {
    var result = { "unexpressed": [] };
    var roles_done = 0;

    if (!(Array.isArray(roles))) roles = [roles];
    if (roles.length < 1) callback(result);

    // Get annotations for all roles of current predicate
    for(var i = 0; i < roles.length; i++) {
        var role = roles[i];
        var role_span = role['span']['target'];
        var role_refs = role['externalReferences']['externalRef'];

        if (!(Array.isArray(role_span))) role_span = [role_span];

        // Get most recent annotation for current role
        getMostRecentExternalReference(role_refs, function(type, referents) {
            if (role["span"] === "") {
                result["unexpressed"].push({ "premon": type, "predicate": pr_id });
                roles_done++;

                if (roles_done >= roles.length) {
                    callback(result);
                }
            } else {    
                for (var j = 0; j < role_span.length; j++) {
                    var cur_t_id = role_span[j]["attr"]["id"];
                    var cur_term = { "premon": type, "predicate": pr_id };

                    if (!(Array.isArray(result[cur_t_id]))) result[cur_t_id] = [];
                    result[cur_t_id].push(cur_term);
                }

                roles_done++;

                if (roles_done >= roles.length) {
                    callback(result);
                }
            }
        });
    }
}

// Get the frame annotations for a specific predicate
// Parameters: string, list, list, callback
var getPredicateAnnotations = function(pr_id, span, external_references, callback) {
    var result = {};

    // Get the most recent annotation for predicate
    getMostRecentExternalReference(external_references, function(type, referents) {
        for (var i = 0; i < span.length; i++) {
            // Add list entry for current term in predicate span
            var cur_t_id = span[i]['attr']['id'];
            var cur_term = { "premon": type, "predicate": pr_id };

            result[cur_t_id] = cur_term;
        }

        callback(result);
    });
}

/**
 * Get a list of annotations made in the SRL layer of a NAF document
 * @param {object}      srl         Object containing SRL layer of NAF
 * @param {function}    callback    Success callback
 */
var prepareAnnotations = function(srl, callback) {
    // 
    var result = { "frames": {}, "roles": {} };
    var predicates_done = 0;

    if (!Array.isArray(srl)) srl = [srl];
    if (!srl || srl.length == 0) callback(result);

    // Iterate trough SRL layer
    for (var i = 0; i < srl.length; i++) {
        var cur_pr = srl[i];
        var cur_pr_id = cur_pr['attr']['id'];
        var cur_pr_annotation = cur_pr['attr']['status'];
        var cur_pr_refs = cur_pr['externalReferences']['externalRef'];
        var cur_pr_span = cur_pr['span']['target'];

        if (!(Array.isArray(cur_pr_span))) cur_pr_span = [cur_pr_span];

        var span_done = false;
        var roles_done = false;

        // If current predicate is annotated
        if (cur_pr_annotation !== "deprecate") {
            getPredicateAnnotations(cur_pr_id, cur_pr_span, cur_pr_refs, function(annotations) {
                Object.keys(annotations).forEach((key, index) => {
                    result["frames"][key] = annotations[key];
                });

                span_done = true;
                if (span_done && roles_done) {
                    predicates_done++;
                    if (predicates_done >= srl.length) callback(result);
                }
            });

            // Get role annotations for current predicate
            if ("role" in cur_pr) {
                getPredicateRoles(cur_pr_id, cur_pr["role"], function(annotations) {
                    Object.keys(annotations).forEach((key, index) => {
                        if (!(Array.isArray(result["roles"][key]))) result["roles"][key] = [];
                        
                        for (var j = 0; j < annotations[key].length; j++) {
                            result["roles"][key].push(annotations[key][j]);
                        }
                    });
                    
                    roles_done = true;
                    if (span_done && roles_done) {
                        predicates_done++;
                        if (predicates_done >= srl.length) callback(result);
                    }
                });
            } else {
                roles_done = true;
                if (span_done && roles_done) {
                    predicates_done++;
                    if (predicates_done >= srl.length) callback(result);
                }
            }
        } else {
            predicates_done++;
            if (predicates_done >= srl.length) callback(result);
        }
    }
}

// Get NAF info from JSON object
// Parameters: object, string, callback
var json2info = function(jsonObj, nafName, callback){
    // Get all tokens
    var tokens = jsonObj['NAF']['text']['wf'];
    var token_data = getTokenData(tokens);

    // Get all terms
    var terms = jsonObj['NAF']['terms']['term'];
    var multi_word_data = getMultiWordData(terms);

    var srl = [];

    if (jsonObj['NAF']['srl']) {
        srl = jsonObj['NAF']['srl']['predicate'];
    }

    var termData = {};

    // Resulting lists
    var ready_title_terms = [];
    var ready_body_terms = [];

    var wikiTitle = jsonObj['NAF']['nafHeader']['public']['attr']['uri'];
    
    // Iterate trough term layer
    for (var i = 0; i < terms.length; i++){
        var term = terms[i];

        var term_id = term['attr']['id'];
        var term_type = term["attr"]["phrase_type"];
        var term_targets = [term['span']['target']];
        var term_components = term['component'];

        // Term is multi word compound
        if (term_type == "idiom" || term_type == "multi_word") {
            /*
            for (var c = 0; c < term_components.length; c++){
                var comp = term_components[c];
                var compId = comp['attr']['id'];
                var lemma = comp['attr']['lemma'];
                
                var tokenId = term_targets[0]['attr']['id'];
                var sent = token_data[tokenId]['sent'];
                var termData = {'text': lemma, 'tid': compId, 'sent': sent};

                if (sent == '1') {
                    ready_title_terms.push(termData);
                }

                else ready_body_terms.push(termData);
            }
            */
        }
        // Term is component
        else if (term_type == "component") {
            var termTokens = [];
            var parent_term = multi_word_data[term_id]

            for (var t = 0; t < term_targets.length; t++){
                var target = term_targets[t];
                var targetId = target['attr']['id'];
                var targetInfo = token_data[targetId];
                var sent = targetInfo['sent'];

                termTokens.push(targetInfo['text']);
            }

            var termData = { "text": termTokens.join(' '), "tid": term_id, "parent_term": parent_term, "sent": sent };
            
            if (sent == '1') {
                ready_title_terms.push(termData);
            } else {
                ready_body_terms.push(termData);
            }
        }
        // Term is singleton
        else {
            var termTokens = [];
            for (var t = 0; t < term_targets.length; t++){
                var target = term_targets[t];
                var targetId = target['attr']['id'];
                var targetInfo = token_data[targetId];
                var sent = targetInfo['sent'];

                termTokens.push(targetInfo['text']);
            }

            var termData = { "text": termTokens.join(' '), "tid": term_id, "parent_term": "none", "sent": sent };
            
            if (sent == '1') {
                ready_title_terms.push(termData);
            } else {
                ready_body_terms.push(termData);
            }
        }

        if (i == terms.length - 1){
            console.log("Prepare annotations for " + nafName + ". Srl:");

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
    var filename = ANNOTATION_DIR + theUser + '/' + nafName + '.naf';

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
var loadMultipleNAFs = function(nafs, theUser, callback){
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
    anObj['span'] = {'#text': '', 'target': []};

    for (var i = 0; i < tids.length; i++) {
        if (tids[i] != "unexpressed") {
            var tid = tids[i].split('.');

            if (tid.length > 1) {
                anObj['span']['target'].push({'#text': '', 'attr':{'id': tid[2]}});
            } else {
                anObj['span']['target'].push({'#text': '', 'attr':{'id': tid}});
            }
        }
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
    aPredicate['attr']['status'] = "manual";
    aPredicate['externalReferences'] = {'#text': '', 'externalRef': []};

    var aPredicate = addExternalRefs(aPredicate, frame, sessionId, reltype, timestamp);

    aPredicate['span'] = makeSpanLayer(aPredicate, tids);
    aPredicate['role'] = [];

    return aPredicate;
}

var createNewRoleEntry = function(rl_id, semRole, sessionId, referents, mentions, timestamp){
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

var annotateRole = function(jsonData, annotations, sessionId) {
    var roleData = annotations;
    var timestamp = new Date().toISOString().replace(/\..+/, '');

    if ('srl' in jsonData['NAF']){
        var predicates = jsonData['NAF']['srl']['predicate'];

        if (!Array.isArray(predicates)) predicates=[predicates];

        for (var i = 0; i < predicates.length; i++){
            if (predicates[i]['attr']['id'] == roleData['prid']){
                if (!('role' in predicates[i]))
                    predicates[i]['role'] = [];
                else if (!(Array.isArray(predicates[i]['role'])))
                    predicates[i]['role'] = [predicates[i]['role']];

                var existingRoles = predicates[i]['role'];

                if (!roleData['rlid']) { // create a new role entry
                    var rl_id = 'rl' + (existingRoles.length + 1).toString();
                    var aRole = createNewRoleEntry(rl_id, roleData['semRole'], sessionId, roleData['referents'], roleData['mentions'], timestamp);

                    predicates[i]['role'].push(aRole);
                    return {'prid': roleData['prid'], 'json': jsonData};
                } else { //update existing role entry
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
    if (annotations['anntype'] == 'taskFrame') {
        return annotateFrame(jsonData, annotations, sessionId);
    } else {
        return annotateRole(jsonData, annotations, sessionId);
    }
}

var createTermEntry = function(term_id, term_data) {
    var term_entry = {};

    term_entry['#text'] = '';
    term_entry['attr'] = { "id": term_id, "lemma": term_data["lemma"], "pos": term_data["pos"], "phrase_type": term_data["type"] }
    term_entry['attr']['id'] = term_id;
    term_entry['span'] = makeSpanLayer(term_entry, term_data["word_span"]);
    term_entry["component"] = [];

    for (var i = 0; i < term_data["components"].length; i++) {
        term_entry["component"][i] = { "attr": { "id":  term_data["components"][i] }};
    }

    return term_entry;
}

var createCompoundTerm = function(json_data, task, correction, session_id) {
    var term_layer = json_data["NAF"]["terms"]["term"];

    if (!Array.isArray(term_layer)) term_layer = [term_layer];

    var pos = "";
    var type = "";

    // Set POS and phrase type given the task
    if (task == 1) {
        pos = "V";
        type = "multi_word";
    } else if (task == 3) {
        pos = "idio";
        type = "idiom";
    }

    var word_span = [];
    var components = correction["tokens"];
    var term_num = term_layer.length + 1;

    for (var i = 0; i < components.length; i++) {
        components[i] = components[i].split(".")[2];
    }

    // Iterate trough terms in term layer
    for (var i = 0; i < term_layer.length; i++) {
        var cur_term_id = term_layer[i]["attr"]["id"];

        // Current term in correction tokens
        if (components.indexOf(cur_term_id) >= 0) {
            term_layer[i]["attr"]["phrase_type"] = "component";
            var cur_term_wspan = term_layer[i]["span"]["target"];

            if (!Array.isArray(cur_term_wspan)) cur_term_wspan = [cur_term_wspan];

            for (var j = 0; j < cur_term_wspan.length; j++) {
                word_span.push(cur_term_wspan[j]["attr"]["id"]);
            }
        }
    }

    var term_id = "t" + term_num;
    var term_data = {
        "lemma": correction["lemma"],
        "pos": pos,
        "type": type,
        "word_span": word_span,
        "components": components
    }

    var new_term = createTermEntry(term_id, term_data);

    term_layer.push(new_term);
    json_data["NAF"]["terms"]["term"] = term_layer;

    return json_data;
}

var addMarkableCorrectionToJson = function(json_data, task, correction, session_id) {
    // Create phrasal verb or idiom
    if (task == 1 || task == 3) {
        return createCompoundTerm(json_data, task, correction, session_id)
    }
}

var saveNAF = function(file_name, json_data, callback){
    var parser = new jsonParser(jsonOptions);
    var xml = parser.parse(json_data);

    fs.writeFile(file_name, xml, function(err, data) {
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

// Endpoint to get all projects and incident types
app.get("/projects", isAuthenticated, function(req, res) {
    // Get projects and types
    var projects = Object.keys(proj2inc);
    var types = Object.keys(type2inc);

    // Return projects and types
    res.send({ "projects": Array.from(projects), "types": Array.from(types) });
});

// Endpoint to get all incidents of a certain type in a project
app.get("/get_project_incidents", isAuthenticated, function(req, res) {
    // Get parameters
    var type = req.query["type"];
    var project = req.query["project"];

    // Get all incidents
    var incident_documents = Object.keys(inc2doc);
    var incidents_of_type = Array.from(type2inc[type]);
    var incidents_of_project = Array.from(proj2inc[project]);

    // Find incidents in project and of type
    var result = _.intersection(incident_documents, incidents_of_type, incidents_of_project);

    // Return result
    res.send({ "new": Array.from(result), "old": [] });
});

// Endpoint to load an incident
app.get('/load_incident', isAuthenticated, function(req, res) {
    // Check if incident is provided
    if (!req.query['incident']) {
        res.sendStatus(400); //("Not OK: incident id not specified");
    } else {
        // Get naf files using parameters
        var incident_id = req.query['incident'];
        var naf_files = inc2doc[incident_id];

        // Load NAF files and return
        loadMultipleNAFs(naf_files, req.user.user, function(data) {
            console.log("All nafs loaded. returning the result now");
            res.send({ "nafs": data });
        });
    }
});

// Endpoint to get all frames
app.get('/get_frames', isAuthenticated, function(req, res) {
    // Resulting lists
    var likely_frames = [];
    var candidate_frames = [];
    var pos_candidate_frames = [];
    var other_frames = [];

    // Iterate of allFramesInfo
    Object.keys(allFramesInfo).forEach((cur_frame_premon, index) => {
        // Extract frame information
        var cur_frame_label = allFramesInfo[cur_frame_premon]['frame_label'];
        var cur_frame_def = allFramesInfo[cur_frame_premon]['definition'];
        var cur_frame_framenet = allFramesInfo[cur_frame_premon]['framenet_url'];

        // Push frame information to frame list
        var cur_frame = { "label": cur_frame_label, 'value': cur_frame_premon, 'definition': cur_frame_def, 'framenet': cur_frame_framenet };
        other_frames.push(cur_frame);
    });

    // Sort other frames by their label
    other_frames = sortObjectsByKey(other_frames, "label");

    res.send({'Likely': likely_frames, 'Candidate': candidate_frames, 'Pos candidate': pos_candidate_frames, 'Other': other_frames});
});

// Endpoint to get frame elements of a specific frame
app.get('/get_frame_elements', isAuthenticated, function(req, res) {
    // Check if frame is provided
    if (!req.query["frame"]) {
        res.sendStatus(400);
    } else {
        // Get Frame elements and return results
        getFrameElements(req.query["frame"], function(result) {
            res.send(result);
        });
    }
});

// TODO: move to prepare annotations
// Endpoint to get annotated frame elements
app.get('/get_roles', isAuthenticated, function(req, res) {
    if (!req.query['docid'] || !req.query['prid']){
        res.sendStatus(400);
    } else {
        var docid = req.query['docid'];

        loadNAFFile(docid, req.user.user, false, function(rawData){
            var the_id = req.query['prid'];

            getRolesForPredicate(rawData, the_id, function(roleData) {
                res.send(roleData);
            });
        });
    }
});

// Endpoint to store markable corrections set in request body
app.post('/store_markable_correction', isAuthenticated, function(req, res) {
    // Get user information
    var user = "sam";//req.user.user;
    var login_time = req.session.visited;

    console.log("Storing markable correction received from " + user);

    // Check if incident id is provided
    if (!req.body.incident) {
        console.error("Storing of markable correction: incident not specified - user: " + user);
        res.sendStatus(400);
    } else {
        // Get annotation data from request body
        var task = req.body["task"];
        var correction_data = req.body["task_data"] || {};
        var document_id = req.body["doc_id"];

        // Load NAF file using incident info
        loadNAFFile(document_id, user, false, function(naf_data) {
            var language = document_id.split('/')[0];
            var title = document_id.split('/')[1];
            var user_annotation_dir = ANNOTATION_DIR + user + '/' + language + '/';

            // Make new directory for user and language if needed
            mkdirp(user_annotation_dir, function (error) {
                if (error) {
                    console.error("Error with creating a directory:\n" + error);
                } else {
                    // Update JSON with new annotations
                    var naf_file = user_annotation_dir + title + ".naf";
                    
                    // Add markables to JSON data
                    var new_json = addMarkableCorrectionToJson(naf_data, task, correction_data, req.sessionID);

                    /* MARKABLE DATA FORMAT:
                        TASKS:
                            1 = create phrasal verb
                            2 = remove phrasal verb
                            3 = create idiom
                            4 = remove idiom
                            5 = create compound
                            6 = remove compund

                        EXAMPLES:
                            1. {
                                "task": 1
                                "taskdata": {
                                    "lemma": "blah"
                                    "tokens": ["t1", "t2"]
                                }
                            }

                            2. {
                                "task": 3
                                "taskdata": {
                                    "lemma": "blah"
                                    "tokens": ["t1", "t2"]
                                }
                            }
                    */

                    // Save session info (?)

                    console.log("File " + document_id + " loaded. Now updating and saving.");

                    // Save JSON in NAF
                    saveNAF(naf_file, new_json, function(error) {
                        if (error) {
                            console.log('Error obtained with saving: ' + error);
                            res.sendStatus(400).json({ "error": error });
                        } else {
                            console.log("Sending response");
                            res.sendStatus(200);
                        }
                    });
                }
            });
        });
    }
});

// Endpoint to store annotations set in request body
app.post('/store_annotations', isAuthenticated, function(req, res) {
    // Get user information
    var user = req.user.user;
    var login_time = req.session.visited;

    console.log("Storing request received from " + user);

    // Check if incident id is provided
    if (!req.body.incident) {
        console.error("Storing of annotations: incident not specified - user: " + user);
        res.sendStatus(400);
    } else {
        // Get annotation data from request body
	    var annotations = req.body.annotations || {};
        var document_id = annotations["doc_id"];

        // Load NAF file using incident info
        loadNAFFile(document_id, user, false, function(naf_data) {
            var language = document_id.split('/')[0];
            var title = document_id.split('/')[1];
            var user_annotation_dir = ANNOTATION_DIR + user + '/' + language + '/';

            // Make new directory for user and language if needed
            mkdirp(user_annotation_dir, function (error) {
                if (error) {
                    console.error("Error with creating a directory:\n" + error);
                } else {
                    // Update JSON with new annotations
                    var naf_file = user_annotation_dir + title + ".naf";
                    var new_naf_data = addAnnotationsToJson(naf_data, annotations, req.sessionID);

                    var updatedJson = saveSessionInfo(new_naf_data["json"], req.sessionID, user, login_time);
                    var pr_id = new_naf_data["prid"];

                    console.log("File " + document_id + " loaded. Now updating and saving.");

                    saveNAF(naf_file, updatedJson, function(error) {
                        if (error) {
                            console.log('Error obtained with saving: ' + error);
                            res.status(400).json({ "error": error });
                        } else {
                            console.log("Sending response with predicate ID " + pr_id);
                            res.send({ "prid": pr_id, "docid": document_id });
                        }
                    });
                }
            });
        });
    }
});

// Endpoint to get structured data for an incident (with user annotations)
app.get("/get_structured_data", isAuthenticated, function(req, res) {
    if (!req.query["incident"]) {
        res.sendStatus(400);
    } else {
        // Get query parameters
        var incident_id = req.query["incident"];
        var user = req.user.user

        var json_data = inc2str[incident_id];
        var file_path = ANNOTATION_DIR + user + "/customrefs.json";

        // Load custom referents data
        fs.readFile(file_path, "utf-8", function(error, data) {
            if (error) {
                console.log(error);
                res.sendStatus(500);
            } else {
                data = data.trim();

                // Check if data in file
                if (data && data != "") {
                    customRefs = JSON.parse(data);
                    if (customRefs[incident_id]) json_data['user:custom'] = customRefs[incident_id];
                }

                res.send(json_data);
            }
        });
    }
});

// TODO: refactor
app.post('/addreferent', isAuthenticated, function(req, res){
    var newRef=req.body.newref;
    var inc=req.body.inc;
    var u = req.user.user;

    var newRefLink = inc + '#' + req.sessionID + '#' + newRef;
    var aReferent=newRefLink + '|' + newRef;

    var refFilePath=ANNOTATION_DIR + u + '/customrefs.json';
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

app.listen(PORT, function() {
	console.log('started annotation tool nodejs backend on port ' + PORT);
});

module.exports = app;
