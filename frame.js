// =====================================
//#region Load dependencies

var express = require('express');
// var request = require('request');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressSession = require('express-session');

var fs = require('fs');
var xmlParser = require('fast-xml-parser');
var jsonParser = require("fast-xml-parser").j2xParser;
var morgan = require('morgan');
// var glob = require('glob');
var mkdirp = require('mkdirp');
var _ = require('underscore');

var app = express();

//#endregion

// =====================================
//#region Applcation configuration
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
const { off } = require('process');
const { json } = require('express');
app.use(flash());

// Set paths
app.use('/', express.static('public/html'));
app.use('/js', express.static('public/js'));
app.use('/css', express.static('public/css'));
app.use('/pdf', express.static('public/assets/pdf'));
app.use('/img', express.static('public/assets/images'));
app.use('/logs', express.static('logs'));

const LOCK_TIME = 20 // Time in minutes
const CONTRASTING_COLORS = ['#731d1d', '#ff8080', '#a6877c', '#f2853d',
                            '#402310', '#7f4400', '#e5b073', '#8c7000',
                            '#ffd940', '#eeff00', '#64664d', '#2a4000',
                            '#86b32d', '#d6f2b6', '#20f200', '#00660e',
                            '#7ca692', '#00cc88', '#00e2f2', '#00474d',
                            '#36a3d9', '#397ee6', '#26364d', '#acc3e6',
                            '#2d3eb3', '#1f00e6', '#311659', '#b836d9',
                            '#d5a3d9', '#644d66', '#80206c', '#f200a2'];

// Settings
const GUIDELINESVERSION = 'v1'
const PORT = 8787

const inc2doc_file = 'data/json/inc2doc_index.json';
const inc2str_file = 'data/json/inc2str_index.json';
const type2inc_file = 'data/json/type2inc_index.json';
const proj2inc_file = 'data/json/proj2inc_index.json';

const likely_frames_file = 'data/frames/dominant_frame_info.json';
const frame_info_file = 'data/frames/frame_to_info.json';

const lexical_lookup = 'data/lexical_lookup';

const DATA_DIR = 'data/naf/';

const ANNOTATION_DIR = 'annotation/'

LockedIncidents = {}

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
//#endregion

// =====================================
//#region Load data files
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
//#endregion

// =====================================
//#region Application routes
app.get('/', function(req, res){
    res.sendFile('index.html', {root:'./public/html'});
});

app.get('/dash', isAuthenticated, function(req, res){
    res.render('dash.html', { username: req.user.user });
});

app.get('/annotation', isAuthenticated, function(req, res){
    res.render('annotation.html', { username: req.user.user });
});
//#endregion

// =====================================
//#region Passport function
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
    res.sendStatus(200);
});
 
app.get('/logout', function(req, res) {
    req.session.destroy();
    req.logout();

    res.redirect('/');
});
//#endregion

// =====================================
//#region Authentication utilities
function isAuthenticated(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}
//#endregion

// =====================================
//#region Helper utilities
/**
 * Returns a sorted array of objects based on the sorting key
 * @param {array}       objects     Array of objects to be sorted
 * @param {string}      key         Key of objects to sort on
 */
function sortObjectsByKey(objects, key) {
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
function moreRecent(date_a, date_b) {
    if (!date_a)
        return true;
    else
        return new Date(date_a) <= new Date(date_b);
}
//#endregion

// =====================================
//#region Document reading utilities
function getLatestExternalReference(references) {
    // Only 1 external reference found
    if (!(Array.isArray(references))) {
        return references['attr']['reference'];
    } else {
        var most_recent = undefined;

        // Check timestamp of each reference
        for (var i in references) {
            var reference = references[i];
            var reference_time = reference['attr']['timestamp'];

            if (most_recent) {
                if (moreRecent(most_recent['attr']['timestamp'], reference_time)) {
                    most_recent = reference;
                }
            } else {
                most_recent = reference;
            }
        }

        return most_recent['attr']['reference'];
    }
}

/**
 * Convert raw NAF token layer object to a formated json object
 * @param {object}      token_layer The raw NAF object to be converted
 */
function readTokenLayer(token_layer) {
    var result = {};

    for (var i in token_layer) {
        var token = token_layer[i];
        var token_id = token['attr']['id'];
        var token_sent = token['attr']['sent'];
        var token_subs = {};
        
        // Token has subtokens
        if (token['subtoken'] != undefined) {
            var subtokens = token['subtoken'];
            if (!Array.isArray(subtokens)) subtokens = [subtokens];

            for (var j in subtokens) {
                token_subs[subtokens[j]['attr']['id']] = { 'text': subtokens[j]['__cdata'] };
            }
        }

        result[token_id] = { 'sent': token_sent, 'text': token['__cdata'], 'sub': token_subs};
    }

    return result;
}

/**
 * FIXME: Handle multiword and compound deprection
 * 
 * Convert raw NAF term layer object to a formated json object
 * @param {object}      term_layer  The raw NAF object to be converted
 * @param {object}      token_data  Information of all tokens in token layer
 */
function readTermLayer(term_layer, token_data) {
    var result = [[], []];

    // Loop trough term layer
    for (var i in term_layer) {
        var term = term_layer[i];
        var term_id = term['attr']['id'];

        // Term is part of multiword
        if (term['attr']['component_of'] != undefined) {
            var par_term_id = term['attr']['component_of'];
            var target_token_id = term['span']['target']['attr']['id'];
            var target_token = token_data[target_token_id];
            var term_data = { 'text': target_token['text'],
                              'lemma': term['attr']['lemma'],
                              't_select': par_term_id,
                              'p_select': par_term_id,
                              'type': 'multiword',
                              'sent': target_token['sent'] };

            if (target_token['sent'] == '1') {
                result[0].push(term_data);
            } else {
                result[1].push(term_data);
            }
        }

        // Term is part compound
        else if (term['attr']['compound_type'] != undefined) {
            var sub_terms = term['component'];
            var target_token_id = term['span']['target']['attr']['id'];
            var target_token = token_data[target_token_id];

            for (var j in sub_terms) {
                var sub_term = sub_terms[j];
                var sub_term_id = sub_term['attr']['id'];

                var target_subtoken_id = sub_term['span']['target']['attr']['id'];
                var target_sub_token = target_token['sub'][target_subtoken_id];
                var sub_term_data = { 'text': target_sub_token['text'], // FIXME: Text based on len & offset
                                      'lemma': sub_term['attr']['lemma'],
                                      't_select': sub_term_id,
                                      'p_select': term_id,
                                      'type': 'compound',
                                      'sent': target_token['sent'] };

                if (target_token['sent'] == '1') {
                    result[0].push(sub_term_data);
                } else {
                    result[1].push(sub_term_data);
                }
            }
        }

        // Term is singleton
        else {
            var target_token_id = term['span']['target']['attr']['id'];
            var target_token = token_data[target_token_id];
            var term_data = { 'text': target_token['text'],
                              'lemma': term['attr']['lemma'],
                              't_select': term_id,
                              'p_select': term_id,
                              'type': 'singleton',
                              'sent': target_token['sent'] };

            if (target_token['sent'] == '1') {
                result[0].push(term_data);
            } else {
                result[1].push(term_data);
            }
        }
    }

    return result;
}

/**
 * Convert raw NAF role layer object to a formated json object
 * @param {object}      role_layer  The raw NAF object to be converted
 */
function readRoleLayer(role_layer) {
    var result = [];

    if (!(Array.isArray(role_layer))) role_layer = [role_layer];

    // Loop over each frame element for current predicate
    for (var i in frame_elements) {
        var frame_element = frame_elements[i];

        var references = frame_element['externalReferences']['externalRef'];
        var reference = getLatestExternalReference(references);

        var frame_element_span = frame_element['span']['target'];
        if (!(Array.isArray(frame_element_span))) frame_element_span = [frame_element_span];

        // Store frame element data need in result
        result.push({ 'reference': reference, 'span': frame_element_span });
    }

    return result;
}

/**
 * Convert raw NAF SRL layer object to a formated json object
 * @param {object}      srl_layer   The raw NAF object to be converted
 */
function readSRLLayer(srl_layer) {
    var result = [{}, {}];

    // Loop over each entry in SRL layer
    for (var i in srl_layer) {
        var predicate = srl_layer[i];
        var predicate_id = predicate['attr']['id'];

        // Get most recent annotation for current predicate if not deprecated
        if (predicate['attr']['status'] !== 'deprecated') {
            var references = predicate['externalReferences']['externalRef'];
            var reference = getLatestExternalReference(references);
            
            // Loop over each term in the predicate span
            var predicate_span = predicate['span']['target'];
            if (!(Array.isArray(predicate_span))) predicate_span = [predicate_span];

            for (var i in predicate_span) {
                // Store annotation for current term in result
                var term = predicate_span[i];
                var term_id = term['attr']['id'];

                result[0][term_id] = { 'premon': reference, 'predicate': predicate_id };
            }

            // Get frame element annotations
            if ('role' in predicate) {
                var frame_elements = readRoleLayer(predicate['role']);

                // Loop over each frame element
                for (var j in frame_elements) {
                    var frame_element = frame_elements[j]
                    var reference = frame_element['reference'];

                    // Loop over each term in frame element span
                    for (var k in frame_element['span']) {
                        var term = frame_element['span'][k];
                        var term_id = term['attr']['id'];

                        result[1][term_id] = { 'premon': reference, 'predicate': predicate_id };
                    }
                }
            }
        }
    }

    return result;
}

/**
 * Convert raw NAF coreferences layer object to a formated json object
 * @param {object}      coref_layer The raw NAF object to be converted
 */
function readCoreferencesLayer(coref_layer) {
    var result = {};

    // Iterate through coreferences layer
    for (var i in coref_layer) {
        var coreference = coref_layer[i];

        var coref_span = coreference['span']['target'];
        if (!Array.isArray(coref_span)) coref_span = [coref_span];

        var references = coreference['externalReferences'];
        references = references !== undefined ? references['externalRef'] : [];

        if (references) {
            var reference = getLatestExternalReference(references);
            for (var i in coref_span) {
                var term_id = coref_span[i]['attr']['id'];

                result[term_id] = reference;
            }
        }
    }

    return result;
}

/**
 * Convert raw NAF object to a formated json object with annotations
 * @param {object}      json_data   The raw NAF object to be converted
 * @param {string}      doc_name    The name of the NAF document
 */
function readNAFFile(json_data, doc_name) {
    // Get token layer and convert to formatted data
    var token_layer = json_data['NAF']['text']['wf'];
    var token_data = readTokenLayer(token_layer);

    // Get term layer
    var term_layer = json_data['NAF']['terms']['term'];

    // Get coreferences layer
    var coref_layer = json_data['NAF']['coreferences'];
    var coref_layer = coref_layer != undefined ? coref_layer['coref'] : [];
    if (!Array.isArray(coref_layer)) coref_layer = [coref_layer];

    // Get SRL layer
    var srl_layer = json_data['NAF']['srl'];
    var srl_layer = srl_layer != undefined ? srl_layer['predicate'] : [];
    if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];

    var term_info = readTermLayer(term_layer, token_data);
    var predicates = readSRLLayer(srl_layer);
    var coreferences = readCoreferencesLayer(coref_layer);

    return { 'name': doc_name, 'title': term_info[0], 'body': term_info[1],
             'frames': predicates[0], 'frame_elements': predicates[1],
             'coreferences': coreferences }
}

/**
 * Load a single NAF file into a json object
 * @param {string}      filename    The name of the naf file to load
 * @param {boolean}     adapt       Set to true if output format should be info
 * @param {callback}    callback    Function to call when done loading file
 */
function loadNAFFile(filename, adapt, callback) {

    // Check annotated version first
    var file_path = ANNOTATION_DIR + filename + '.naf';
    if (!(fs.existsSync(file_path))) {
        file_path = DATA_DIR + filename + '.naf';
    }

    fs.readFile(file_path, 'utf-8', function(error, data) {
        var json = xmlParser.parse(data, xmlOptions);

        if (adapt) {
            callback(readNAFFile(json, filename));
        } else {
            callback(json);
        }
    });
}

/**
 * Load multiple NAF files into a single json object
 * @param {array}       nafs        Array containing the filenames to load
 * @param {callback}    callback    Function to call when done loadin files
 */
function loadMultipleNAFs(nafs, callback){
    var result = [];

    // Load each NAF file and return if all files are loaded
    for (var i = 0; i < nafs.length; i++) {
        loadNAFFile(nafs[i], true, function(json_data) {
            result.push(json_data);

            // Call callback when ready
            if (result.length == nafs.length) {
                callback(result);
            }
        });
    }
}
//#endregion

// =====================================
//#region Document writing utilities
function createLayerIfNotExists(json_data, layer_name, layer_item_name) {
    if (!(layer_name in json_data)) {
        json_data[layer_name] = {};
        json_data[layer_name][layer_item_name] = [];
    }

    return json_data;
}

function addExternalReferences(object, reference_data) {
    references = object['externalReferences']['externalRef']
    if (!Array.isArray(references)) references = [references]; 

    references.push({ 'attr': reference_data })
    object['externalReferences']['externalRef'] = references;
    return object;
}

//#region Markable correction
function addMultiwordEntry(json_data, multiword_data) {
    json_data['NAF'] = createLayerIfNotExists(json_data['NAF'], 'multiwords', 'mw');
    var mw_layer = json_data['NAF']['multiwords']['mw'];
    if (!Array.isArray(mw_layer)) mw_layer = [mw_layer];

    multiword_data['mcn_type'] = multiword_data['mcn_type'] == 1 ? 'phrasal' : 'idiom';
    var pos = multiword_data['mcn_type'] == 1 ? 'VERB' : '';

    // Prepare multiword entry creation
    var multiword_id = 'mw' + (mw_layer.length + 1).toString();
    var multiword_entry = { 'attr': { 'id': multiword_id,
                                      'type': multiword_data['mcn_type'],
                                      'lemma': multiword_data['lemma'],
                                      'pos': pos },
                            'component': []};

    // Add each target term to component layer of multiword entry
    var target_ids = multiword_data['target_ids'];
    for (var i in target_ids) {
        var component_id = multiword_id + '.c' + i.toString();
        var target_term_id = target_ids[i].split('.')[2];
        var component_entry = { 'attr': { 'id': component_id },
                                'span': { 'target': { 'attr': { 'id': target_term_id }}}};
        multiword_entry['component'].push(component_entry);
    }

    // Add entry to multiword layer
    mw_layer.push(multiword_entry);
    json_data["NAF"]["multiwords"]["mw"] = mw_layer;
    return json_data, multiword_id;
}

function updateMultiwordTerms(json_data, multiword_id, target_term_ids) {
    var term_layer = json_data['NAF']['terms']['term'];
    if (!Array.isArray(term_layer)) term_layer = [term_layer];

    for (var i in term_layer) {
        var term = term_layer[i];
        var term_id = term['attr']['id'];

        if (target_term_ids.indexOf(term_id) >= 0) {
            term_layer[i]['attr']['component_of'] = multiword_id;
        }
    }

    json_data['NAF']['terms']['term'] = term_layer;
    return json_data;
}

function addCompoundEntry(json_data, compound_data) {
    var term_layer = json_data['NAF']['terms']['term'];
    if (!Array.isArray(term_layer)) term_layer = [term_layer];

    var token_id = undefined;
    var term_head = compound_data['target_id'] + '.c' + compound_data['head'];

    // Find the term layer element to edit
    for (var i in term_layer) {
        var term = term_layer[i]
        var term_id = term['attr']['id'];

        if (term_id == compound_data['target_id']) {
            token_id = term['span']['target']['attr']['id'].toString();

            // Update attribute information of term
            term_layer[i]['attr']['compound_type'] = 'endocentric';
            term_layer[i]['attr']['head'] = term_head;

            // Add component layer
            term_layer[i]['component'] = [];
            for (var j in compound_data['subterms']) {
                var subterm = compound_data['subterms'][j];
                var subterm_id = compound_data['target_id'] + '.c' + j;
                var subtoken_id = token_id + '.sub' + j;

                var component_entry = { 'attr': { 'id': subterm_id,
                                                  'pos': subterm['pos'],
                                                  'lemma': subterm['lemma'] },
                                        'span': { 'target': { 'attr': { 'id': subtoken_id }}}};
                term_layer[i]['component'].push(component_entry);
            }

            break;
        }
    }

    json_data['NAF']['terms']['term'] = term_layer;
    return json_data, token_id;
}

function updateCompoundTokens(json_data, target_token_id, compound_data) {
    var token_layer = json_data['NAF']['text']['wf'];
    if (!Array.isArray(token_layer)) token_layer = [token_layer];

    for (var i in token_layer) {
        var token = token_layer[i];
        var token_id = token['attr']['id'];

        if (token_id == target_token_id) {
            var offset = token['attr']['offset'];

            token_layer[i]['subtoken'] = [];

            for (var j in compound_data['subterms']) {
                var subterm = compound_data['subterms'];
                var subterm_length = subterm['length'];
                var subterm_cdata = subterm['cdata'];
                var subtoken_id = token_id + '.sub' + j;

                var subtoken_entry = { 'attr': { 'id': subtoken_id,
                                                 'length': subterm_length,
                                                 'offset': offset,
                                               },
                                       '__cdata': subterm_cdata }
                token_layer[i]['subtoken'].push(subtoken_entry);

                offset += parseInt(subterm_length);
            }

            break;
        }
    }

    json_data['NAF']['text']['wf'] = token_layer;
    return json_data;
}

function deprecateMultiwordEntry(json_data, target_id) {
    var term_layer = json_data["NAF"]["terms"]["term"];
    if (!Array.isArray(term_layer)) term_layer = [term_layer];

    var mw_layer = json_data['NAF']['multiwords']['mw'];
    if (!Array.isArray(mw_layer)) mw_layer = [mw_layer];

    for (var i in term_layer) {
        var term = term_layer[i];
        
        if ('component_of' in term['attr'] && term['attr']['component_of'] == target_id) {
            delete term_layer[i]['attr']['component_of'];
        }
    }

    for (var i in mw_layer) {
        var mw = mw_layer[i];
        var mw_id = mw['attr']['id'];

        if (mw_id == target_id) {
            mw_layer[i]['attr']['status'] = 'deprecated';
            break;
        }
    }

    json_data["NAF"]["multiwords"]["mw"] = mw_layer;
    json_data['NAF']['terms']['term'] = term_layer;
    return json_data;
}

function removeCompoundEntry(json_data, target_id) {
    var token_layer = json_data['NAF']['text']['wf'];
    if (!Array.isArray(token_layer)) token_layer = [token_layer];

    var term_layer = json_data['NAF']['terms']['term'];
    if (!Array.isArray(term_layer)) term_layer = [term_layer];

    for (var i in term_layer) {
        var term_id = term_layer[i]['attr']['id'];

        if (term_id == target_id) {
            delete term_layer[i]['component'];
            delete term_layer[i]['attr']['compound_type'];
            delete term_layer[i]['attr']['head'];
            target_id = term_layer[i]['span']['target'][0]['attr']['id'].toString();

            break;
        }
    }

    for (var i in token_layer) {
        var token_id = token_layer[i]['attr']['id'];
        
        if (token_id == target_id) {
            delete token_layer[i]['subtoken'];
            break;
        }
    }

    json_data['NAF']['text']['wf'] = text_layer;
    json_data['NAF']['terms']['term'] = term_layer;
    return json_data;
}
//#endregion

//#region Frame annotation
function addPredicateEntry(json_data, predicate_data, session_id) {
    json_data['NAF'] = createLayerIfNotExists(json_data['NAF'], 'srl', 'predicate');
    var srl_layer = json_data['NAF']['srl']['predicate'];
    if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];
    
    // Construct predicate entry using predicate data
    var predicate_id = 'pr' + (srl_layer.length + 1).toString();
    var predicate_entry = { 'attr': { 'id': predicate_id,
                                      'status': 'manual' },
                            'span': { 'target': [] },
                            'externalReferences:': { 'externalRef': [] }};
    
    // Construct span layer
    var target_data = { 'attr': { 'id': predicate_data['target_term'] }};
    predicate_entry['span']['target'].push(target_data);

    var timestamp = new Date().toISOString().replace(/\..+/, '')
    
    // Construct external references layer in predicate
    var reference_data = { 'reference': predicate_data['frame'],
                           'resource': 'http://premon.fbk.eu/premon/fn17',
                           'timestamp': timestamp,
                           'source': session_id,
                           'reftype': predicate_data['type'] };
    predicate_entry = addExternalReferences(predicate_entry, reference_data);

    // Add external reference for LU to predicate
    if (predicate_data['has_lu']) {
        var lu_data = { 'reference': predicate_data['lu'],
                        'resource': predicate_data['lu_resource'],
                        'timestamp': timestamp,
                        'source': session_id,
                        'reftype': 'http://www.w3.org/ns/lemon/ontolex#Sense' };
        predicate_entry = addExternalReferences(predicate_entry, lu_data);
    }

    // Store result in json_data and return
    srl_layer.push(predicate_entry);
    json_data['NAF']['srl']['predicate'] = srl_layer;
    return json_data;
}

function deprecatePredicateEntry(json_data, target_id) {
    var srl_layer = json_data['NAF']['srl']['predicate'];
    if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];

    for (var i in srl_layer) {
        var predicate = srl_layer[i];
        var predicate_id = predicate['attr']['id'];

        if (predicate_id == target_id) {
            srl_layer[i]['status'] = 'deprecated';
            break;
        }
    }

    json_data['NAF']['srl']['predicate'] = srl_layer;
    return json_data;
}
//#endregion

//#region Frame element annotation
function addRoleEntry(json_data, target_id, role_data, session_id) {
    var srl_layer = json_data['NAF']['srl']['predicate'];
    if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];

    // Loop over predicates and find target predicate
    for (var i in srl_layer) {
        var predicate = srl_layer[i];
        var predicate_id = predicate['attr']['id'];

        if (predicate_id == target_id) {
            var role_layer = predicate['role'];
            if (!Array.isArray(role_layer)) role_layer = [role_layer];

            // Construct role entry
            var role_id = 'pr' + (role_layer.length + 1).toString();
            var role_entry = { 'attr': { 'id': role_id,
                                         'status': 'manual' },
                               'span': { 'target': [] },
                               'externalReferences:': { 'externalRef': [] }};
            
            // Construct span layer
            if (role_data['target_term'] != 'unexpressed') {
                var target_data = { 'attr': { 'id': role_data['target_term'] }};
                role_entry['span']['target'].push(target_data);
            }

            // Construct external references layer in role
            var reference_data = { 'reference': role_data['role'],
                                   'resource': 'http://premon.fbk.eu/premon/fn17',
                                   'timestamp': new Date().toISOString().replace(/\..+/, ''),
                                   'source': session_id,
                                   'reftype': '' }
            role_entry = addExternalReferences(reference_data)

            // Store result in json_data
            srl_layer.push(predicate_entry);
            json_data['NAF']['srl']['predicate'] = srl_layer;

            break;
        }
    }

    return json_data;
}

function deprecateRoleEntry(json_data, parent_id, target_id) {
    var srl_layer = json_data['NAF']['srl']['predicate'];
    if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];

    for (var i in srl_layer) {
        var predicate = srl_layer[i];
        var predicate_id = predicate['attr']['id'];

        if (predicate_id == parent_id) {
            var role_layer = predicate['role'];

            for (var j in role_layer) {
                var role = role_layer[j];
                var role_id = role['attr']['id'];

                if (role_id == target_id) {
                    srl_layer[i]['role'][j]['attr']['status'] = 'deprecated';
                    break;
                }
            }

            break;
        }
    }

    json_data['NAF']['srl']['predicate'] = srl_layer;
    return json_data;
}
//#endregion

//#region Structured data editing
//#endregion

//#region Coreference annotation
function addCoreferenceEntry(json_data, coreference_data, session_id) {
    json_data['NAF'] = createLayerIfNotExists(json_data['NAF'], 'coreferences', 'coref');
    var coref_layer = json_data['NAF']['coreferences']['coref'];
    if (!Array.isArray(coref_layer)) coref_layer = [coref_layer];

    // Construct coreference entry using reference data
    var coreference_id = 'co' + (coref_layer.length + 1).toString();
    var correference_entry = { 'attr': { 'id': coreference_id,
                                         'status': 'manual',
                                         'type': coreference_data['type'] },
                               'span': { 'target': [] },
                               'externalReferences': { 'externalRef': [] }};
    
    // Construct span layer
    var target_data = { 'attr': { 'id': coreference_data['target_term'][i] }};
    correference_entry['span']['target'].push(target_data);

    // Construct external references layer in coreference
    var reference_data = { 'reference': coreference_data['reference'],
                           'resource': 'http://www.wikidata.org',
                           'timestamp': new Date().toISOString().replace(/\..+/, ''),
                           'source': session_id,
                           'reftype': coreference_data['type'] };
    correference_entry = addExternalReferences(correference_entry, reference_data);

    // Store result in json_data and return
    coref_layer.push(correference_entry);
    json_data['NAF']['coreferences']['coref'] = coref_layer
    return json_data;
}

function deprecateCoreferenceEntry(json_data, target_id) {
    var coref_layer = json_data['NAF']['coreferences']['coref'];
    if (!Array.isArray(coref_layer)) coref_layer = [coref_layer];

    for (var i in coref_layer) {
        var coref = coref_layer[i];
        var coref_id = coref['attr']['id'];

        if (coref_id == target_id) {
            coref_layer[i]['status'] = 'deprecated';
            break;
        }
    }

    json_data['NAF']['coreferences']['coref'] = coref_layer;
    return json_data;
}
//#endregion

//#endregion

// =====================================
//#region Endpoint handling utilities
// FIXME: Fix xml parse issue
function handleMarkableCorrection(json_data, task_data) {
    // Add markable correction
    if (task_data['mcn_task'] == 1) {
        if (task_data['mcn_type'] == 1 || task_data['mcn_type'] == 2) {
            json_data, mw_id = addMultiwordEntry(json_data, task_data);
            return updateMultiwordTerms(json_data, mw_id, task_data['selected'])
        } else if (task_data['mcn_type'] == 3) {
            json_data, t_id = addCompoundEntry(json_data, task_data);
            return updateCompoundTokens(json_data, t_id, task_data)
        }
    }
    
    // Remove markable corrections
    else if (task_data['mcn_task'] == 2) {
        if (task_data['mcn_type'] == 1) {
            return deprecateMultiwordEntry(json_data, task_data['target_id']);
        } else if (task_data['mcn_type'] == 2) {
            return removeCompoundEntry(json_data, task_data['target_id']);
        }
    }

    // TODO: Handle incorrect task data with error
}

function handleFrameAnnotation(json_data, task_data, session_id) {
    var srl_layer = json_data['NAF']['srl']['predicate'];
    if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];

    // Check for span overlap
    for (var i in srl_layer) {
        var predicate = srl_layer[i];
        var predicate_target = predicate['span']['target'];

        if (predicate_target['attr']['id'] in task_data['selected']) {
            srl_layer[i]['status'] = 'deprecated';
        }
    }

    // Update overlap deprecations
    json_data['NAF']['srl']['predicate'] = srl_layer;

    // Create new predicate for each term in selected
    for (var i in task_data['selected']) {
        var predicate_data = { 'frame': task_data['frame'],
                               'type': task_data['type'],
                               'target_term': task_data['selected'][i] };
        json_data = addPredicateEntry(json_data, predicate_data, session_id);
    }

    return json_data;
}

// TODO: Handle frame element update
function handleFrameElementAnnotation(json_data, task_data, session_id) {
    if (task_data['selected'] == []) {
        task_data['selected'] = ['unexpressed'];
    }

    // Create new predicate for each term in span
    for (var i in task_data['selected']) {
        var role_data = { 'role': task_data['role'],
                          'target_term': task_data['selected'][i] };
        json_data = addRoleEntry(json_data, task_data['pr_id'], role_data, session_id);
    }

    return json_data;
}

// TODO: Handle coreference update
function handleCoreferenceAnnotation(json_data, task_data, session_id) {
    var coref_layer = json_data['NAF']['coreferences']['coref'];
    if (!Array.isArray(coref_layer)) coref_layer = [coref_layer];

    // Check for span overlap on different wikidata reference
    for (var i in coref_layer) {
        var coref = coref_layer[i];
        var coref_target = coref['span']['target'];

        if (coref_target['attr']['id'] in task_data['selected']) {
            coref_layer[i]['status'] = 'deprecated';
            break;
        }
    }

    json_data['NAF']['coreferences']['coref'] = coref_layer;

    // Create new coreference entry for each term in selected
    for (var i in task_data['selected']) {
        var coreference_data = { 'reference': task_data['reference'],
                                 'type': task_data['type'],
                                 'target_term': task_data['selected'][i] };
        json_data = addCoreferenceEntry(json_data, coreference_data, session_id);
    }

    return addCoreferenceEntry(json_data, task_data)
}
//#endregion

// =====================================
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

// TODO: Refactor needed
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

var saveNAF = function(file_name, json_data, callback){
    var parser = new jsonParser(jsonOptions);
    var xml = parser.parse(json_data);

    fs.writeFile(file_name, xml, function(err, data) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            console.log('updated!');
            callback(false);
        }
  });
}

// =====================================
// QUERY ENDPOINTS =====================
// =====================================
app.post('/store_annotation', isAuthenticated, function(req, res) {
    var user = req.user.user;
    var login_time = req.session.visited;

    console.log('Storing annotation from: ' + user);

    var document_id = req.body.doc_id;
    var task_id = parseInt(req.body.task_id);
    var task_data = req.body.task_data;

    // Load NAF file for editing
    loadNAFFile(document_id, false, function(json_data) {
        var language = document_id.split('/')[0];
        var title = document_id.split('/')[1];
        var annotation_dir = ANNOTATION_DIR + language + '/';
        var annotated_file_path = annotation_dir + title + ".naf";

        if (task_id == 1) {
            json_data = handleMarkableCorrection(json_data, task_data);
        } else if (task_id == 2) {
            json_data = handleFrameAnnotation(json_data, task_data, req.sessionID);
            json_data = saveSessionInfo(json_data, req.sessionID, user, login_time);
        } else if (task_id == 3) {
            json_data = handleFrameElementAnnotation(json_data, task_data, req.sessionID);
            json_data = saveSessionInfo(json_data, req.sessionID, user, login_time);
        } else if (task_id == 4) {
            json_data = handleCoreferenceAnnotation(json_data, task_data);
        } else {
            // TODO: Handle invalid task
        }

        mkdirp(annotation_dir, function(error) {
            if (error) {
                console.error('Error while creating annotation directory:\n' + error);
            } else {
                saveNAF(annotated_file_path, json_data, function(error) {
                    if (error) {
                        console.error('Error while saving NAF: ' + error);
                        res.sendStatus(400).json({ "error": error });
                    } else {
                        console.log("Successfully saved annotation");
                        res.sendStatus(200);
                    }
                });
            }
        })
    });
});

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
        res.sendStatus(400);
    }    

    // Get naf files using parameters
    var incident_id = req.query['incident'];
    var locked = false;

    var date = new Date();
    var now = date.getTime();

    // Check if incident user tries to load is locked
    if (incident_id in LockedIncidents) {
        // Not locked for user
        if (LockedIncidents[incident_id].user != req.user.user) {
            var lock_time = parseInt(LockedIncidents[incident_id].time);
            if (now - lock_time < LOCK_TIME * 60000) {
                locked = true;
            }
        }
    }

    if (!locked) {
        // Unclock previously locked incident
        Object.keys(LockedIncidents).some(function(k) {
            if (LockedIncidents[k].user === req.user.user) {
                delete LockedIncidents[k];
            }
        });

        // Lock new incident
        LockedIncidents[incident_id] = { 'user': req.user.user, 'time': now }
        var naf_files = inc2doc[incident_id];

        // Load NAF files and return
        loadMultipleNAFs(naf_files, function(data) {
            console.log("All nafs loaded. returning the result now");
            res.send({ "nafs": data });
        });
    } else {
        res.sendStatus(423);
    }
});

// Endpoint to get all frames
app.get('/get_frames', isAuthenticated, function(req, res) {
    if (!req.query['incident'] || !req.query['language'] || !req.query['lemma']) {
        res.sendStatus(400);
    }

    var incident_id = req.query['incident'];
    var language = req.query['language'];
    var lemma = req.query['lemma'];
    // var lexical_path = '/' + language + '/' + incident_id + '.json';
    var lexical_path = '/en/Q40231.json';

    // Load lexical data
    fs.readFile(lexical_lookup + lexical_path, 'utf8', function(err, data) {
        data = JSON.parse(data)
        var result = {};
        var occupied_frames = [];

        if (data['lexical_lookup'][lemma]) {
            var lemma_data = data['lexical_lookup'][lemma];

            // Gather data for selected lemma
            for (key in lemma_data) {
                if (key != 'all_frames') { 
                    var lemma_frames = [];
                    for (frame in lemma_data[key]) {
                        var cur_frame = lemma_data[key][frame];
                        var entry = { 'label': cur_frame[1], 'value': cur_frame[2] };
                        occupied_frames.push(cur_frame[2]);
                        lemma_frames.push(entry);
                    }

                    result[key] = lemma_frames;
                }
            }
        }

        // Gather data for other frames
        result['Other'] = [];
        var ordered = data['ordered_frames'];
        for (frame in ordered) {
            var cur_frame = ordered[frame];
            if (!occupied_frames.includes(cur_frame[1])) {
                var entry = { 'label': cur_frame[1], 'value': cur_frame[2] };
                result['Other'].push(entry)
            }
        }

        res.send(result);
    });
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

        loadNAFFile(docid, false, function(rawData){
            var the_id = req.query['prid'];

            getRolesForPredicate(rawData, the_id, function(roleData) {
                res.send(roleData);
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
        res.send(json_data);

        // Load custom referents data
        // fs.readFile(file_path, "utf-8", function(error, data) {
        //     if (error) {
        //         console.log(error);
        //         res.sendStatus(500);
        //     } else {
        //         data = data.trim();

        //         // Check if data in file
        //         if (data && data != "") {
        //             customRefs = JSON.parse(data);
        //             if (customRefs[incident_id]) json_data['user:custom'] = customRefs[incident_id];
        //         }

        //     }
        // });
    }
});

app.post('/store_structured_data', isAuthenticated, function(req, res) {
    var user = req.user.user;

    console.log("Storing structured data received from " + user);

    if (!req.body.incident) {
        console.error("Storing of structured data: incident not specified - user: " + user);
        res.sendStatus(400);
    } else {
        // Get task data from request body
        var task_data = req.body["task_data"] || {};
        var incident_id = req.body["incident"];

        if (task_data['action'] == 1) {
            // Add wdt item to inc2str
            var relation = task_data['relation'];
            var item = task_data['wdt_uri'] + ' | ' + task_data['label'];
            inc2str[incident_id][relation].push(item);
        } else {
            // Remove wdt item from inc2str
            var item = task_data['item'];
            var relation = task_data['relation'];

            var index = inc2str[incident_id][relation].indexOf(item);
            if (index !== -1) inc2str[incident_id][relation].splice(index, 1);
        }

        // Store inc2str
        fs.writeFile(inc2str_file, JSON.stringify(inc2str), function() {
            res.sendStatus(200);
        });
    }
});

// =====================================
// START THE SERVER ====================
// =====================================

app.listen(PORT, function() {
    console.log('started annotation tool nodejs backend on port ' + PORT);
});

module.exports = app;
