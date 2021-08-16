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
var Libxml = require('node-libxml');
var morgan = require('morgan');
var _ = require('underscore');

var app = express();
var libxml = new Libxml();
libxml.loadDtds(['data/naf/naf.dtd']);

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

// Settings
const GUIDELINESVERSION = 'v1'
const PORT = 8787

const inc2lang2doc_file = 'data/DFNDataReleases/structured/inc2lang2doc_index.json';
const inc2str_file = 'data/DFNDataReleases/structured/inc2str_index.json';
const type2inc_file = 'data/DFNDataReleases/structured/type2inc_index.json';
const proj2inc_file = 'data/DFNDataReleases/structured/proj2inc_index.json';
const labels_file = 'data/DFNDataReleases/structured/labels.json'

const pos_info_file = 'data/DFNDataReleases/lexical_data/part_of_speech/part_of_speech_ud_info.json'
const pos_map_file = 'data/DFNDataReleases/lexical_data/part_of_speech/ud_pos_to_fn_pos.json';
const frame_info_file = 'data/DFNDataReleases/lexical_data/lexicons/frame_to_info.json';

const LL_DIR = 'data/DFNDataReleases/lexical_data/typicality/lexical_lookup/';
const NAF_DIR = 'data/DFNDataReleases/unstructured/';

LockedIncidents = {}
DynamicLexicon = {}

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
    cdataTagName: "#cdata", //default is 'false'
    cdataPositionChar: "\\c",
    localeRange: "", //To support non english character in tag/attribute values.
    parseTrueNumberOnly: true
};

var jsonOptions = {
    attributeNamePrefix : "",
    attrNodeName: "attr", //default is false
    textNodeName : "#text",
    ignoreAttributes : false,
    cdataTagName: "#cdata", //default is false
    cdataPositionChar: "\\c",
    format: true,
    indentBy: "",
    supressEmptyNode: true,
};
//#endregion

// =====================================
//#region Load data files
fs.readFile(inc2lang2doc_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    inc2lang2doc = JSON.parse(data);
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

fs.readFile(labels_file, 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    labels = JSON.parse(data);
});

fs.readFile(frame_info_file, 'utf8', function (err, data){
    if (err) throw err; // we'll not consider error handling for now
    allFramesInfo = JSON.parse(data);
});

fs.readFile(pos_info_file, 'utf8', function (err, data){
    if (err) throw err; // we'll not consider error handling for now
    posInfo = JSON.parse(data);
});

fs.readFile(pos_map_file, 'utf8', function (err, data){
    if (err) throw err; // we'll not consider error handling for now
    posMap = JSON.parse(data);
});

fs.readFile('data/DynamicLexicon.json', 'utf8', function (err, data){
    if (err) throw err; // we'll not consider error handling for now
    DynamicLexicon = JSON.parse(data);
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
    req.session.visited = new Date().string
    res.sendStatus(200);
});
 
app.get('/logout', function(req, res) {
    // Unclock any locked incident by user
    Object.keys(LockedIncidents).some(function(k) {
        if (LockedIncidents[k].user === req.user.user) {
            delete LockedIncidents[k];
        }
    });

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
 * Returns true if date_b is more recent than date_a
 * @param {string}      date_a      First date to check
 * @param {string}      date_b      Second date to check
 */
function moreRecent(date_a, date_b) {
    if (!date_a) {
        return true;
    } else {
        date_a = Date.parse(date_a.replace('UTC', ''));
        date_b = Date.parse(date_b.replace('UTC', ''));
        return date_a <= date_b;
    }
}

Date.prototype.toNAFUTCString = function() {
    var Y = this.getFullYear();
    var m = ('0' + (this.getMonth() + 1)).slice(-2);
    var d = ('0' + (this.getDate())).slice(-2);
    var H = ('0' + this.getHours()).slice(-2);
    var M = ('0' + this.getMinutes()).slice(-2);
    var S = ('0' + this.getSeconds()).slice(-2);
  
    return [Y, '-', m, '-', d, 'T', H, ':', M, ':', S, 'UTC'].join('');
  };
//#endregion

// =====================================
//#region Document reading utilities
function getLatestExternalReference(references) {
    // Only 1 external reference found
    if (!(Array.isArray(references))) {
        return references['attr'];
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

        return most_recent['attr'];
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
                if ('#cdata' in subtokens[j]) {
                    token_subs[subtokens[j]['attr']['id']] = { 'text': subtokens[j]['#cdata'] };
                } else {
                    token_subs[subtokens[j]['attr']['id']] = { 'text': subtokens[j]['#text'] };
                }
            }
        }

        if ('#cdata' in token) {
            result[token_id] = { 'sent': token_sent, 'text': token['#cdata'], 'sub': token_subs};
        } else {
            result[token_id] = { 'sent': token_sent, 'text': token['#text'], 'sub': token_subs};
        }
    }

    return result;
}

/**
 * Convert raw NAF term layer object to a formated json object
 * @param {object}      term_layer  The raw NAF object to be converted
 * @param {object}      token_data  Information of all tokens in token layer
 */
function readTermLayer(term_layer, mw_layer, token_data) {
    var result = [];

    // Loop trough term layer
    for (var i in term_layer) {
        var term = term_layer[i];
        var term_id = term['attr']['id'];

        // Term is part of multiword
        if (term['attr']['component_of'] != undefined) {
            var par_term_id = term['attr']['component_of'];
            var par_term_lem = undefined;

            for (var j in mw_layer) {
                if (mw_layer[j]['attr']['id'] == par_term_id) {
                    par_term_lem = mw_layer[j]['attr']['lemma'];
                }
            }

            console.log(par_term_lem);
            var target_token_id = term['span']['target']['attr']['id'];
            var target_token = token_data[target_token_id];
            var term_data = { 'text': target_token['text'],
                              'lemma': par_term_lem,
                              'pos': term['attr']['pos'],
                              't_select': par_term_id,
                              'p_select': par_term_id,
                              'type': 'multiword',
                              'sent': target_token['sent'] };

            result.push(term_data);
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
                
                var sub_term_data = { 'text': target_sub_token['text'],
                                      'lemma': sub_term['attr']['lemma'],
                                      'pos': sub_term['attr']['pos'],
                                      't_select': sub_term_id,
                                      'p_select': term_id,
                                      'type': 'compound',
                                      'sent': target_token['sent'] };
                result.push(sub_term_data);
            }
        }

        // Term is singleton
        else {
            var target_token_id = term['span']['target']['attr']['id'];
            var target_token = token_data[target_token_id];
            var term_data = { 'text': target_token['text'],
                              'lemma': term['attr']['lemma'],
                              'pos': term['attr']['pos'],
                              't_select': term_id,
                              'p_select': term_id,
                              'type': 'singleton',
                              'sent': target_token['sent'] };
            result.push(term_data);
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
    for (var i in role_layer) {
        var role = role_layer[i];

        var references = role['externalReferences']['externalRef'];
        var reference = getLatestExternalReference(references).reference;

        var role_span = role['span']['target'];
        if (!(Array.isArray(role_span))) role_span = [role_span];

        // Store frame element data need in result
        result.push({ 'id': role['attr']['id'],
                      'status': role['attr']['status'],
                      'reference': reference,
                      'span': role_span });
    }

    return result;
}

/**
 * Convert raw NAF SRL layer object to a formated json object
 * @param {object}      srl_layer   The raw NAF object to be converted
 */
function readSRLLayer(srl_layer, typicality) {
    var result = [{}, { 'unexpressed': [] }];

    // Loop over each entry in SRL layer
    for (var i in srl_layer) {
        var predicate = srl_layer[i];
        var predicate_id = predicate['attr']['id'];
        var predicate_stat = predicate['attr']['status'];

        // Get most recent annotation for current predicate if not deprecated
        if (predicate_stat !== 'deprecated') {
            var references = predicate['externalReferences']['externalRef'];
            var reference = getLatestExternalReference(references).reference;
            
            // Loop over each term in the predicate span
            var predicate_span = predicate['span']['target'];
            if (!(Array.isArray(predicate_span))) predicate_span = [predicate_span];
            var frame_info = allFramesInfo[reference];

            for (var i in predicate_span) {
                // Store annotation for current term in result
                var term = predicate_span[i];
                var term_id = term['attr']['id'];

                result[0][term_id] = { 'status': predicate_stat,
                                       'typicality': typicality[reference],
                                       'label': frame_info.frame_label,
                                       'definition': frame_info.definition,
                                       'premon': reference,
                                       'framenet': frame_info.framenet_url,
                                       'predicate': predicate_id };
            }

            // Get frame element annotations
            if ('role' in predicate) {
                var frame_elements = readRoleLayer(predicate['role']);

                // Loop over each frame element
                for (var j in frame_elements) {
                    var frame_element = frame_elements[j];

                    if (frame_element['status'] == 'deprecated') {
                        continue;
                    }

                    var reference = frame_element['reference'];

                    var role_info = {};
                    for (var k in frame_info['frame_elements']) {
                        var el = frame_info['frame_elements'][k];
                        if (el['rdf_uri'] == reference) {
                            role_info = el;
                            break;
                        }
                    }

                    // Loop over each term in frame element span
                    if (frame_element['span'][0] != undefined) {
                        for (var k in frame_element['span']) {
                            var term = frame_element['span'][k];
                            var term_id = term['attr']['id'];

                            if (!(term_id in result[1])) {
                                result[1][term_id] = [];
                            }

                            result[1][term_id].push({ 'premon': reference,
                                                      'label': role_info['fe_label'],
                                                      'role': frame_element['id'],
                                                      'predicate': predicate_id });
                        }
                    } else {
                        result[1]['unexpressed'].push({ 'premon': reference,
                                                        'label': role_info['fe_label'],
                                                        'role': frame_element['id'],
                                                        'predicate': predicate_id });
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

        if (coreference['attr']['status'] == 'deprecated') {
            continue;
        }

        var coref_span = coreference['span']['target'];
        if (!Array.isArray(coref_span)) coref_span = [coref_span];

        var references = coreference['externalReferences'];
        references = references !== undefined ? references['externalRef'] : [];

        if (references) {
            var reference = getLatestExternalReference(references).reference;
            for (var i in coref_span) {
                var term_id = coref_span[i]['attr']['id'];

                result[term_id] = {
                    'entity': reference,
                    'coreference': coreference['attr']['id'] 
                };
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
function readNAFFile(json_data, doc_name, inc_type) {
    var typfile = 'data/DFNDataReleases/lexical_data/typicality/typicality_scores/' + inc_type + '.json'
    var typicality = JSON.parse(fs.readFileSync(typfile, 'utf8'));

    var source = json_data['NAF']['nafHeader']['public']['attr']['uri'];

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

    var mw_layer = json_data['NAF']['multiwords']['mw'];
    if (!Array.isArray(mw_layer)) mw_layer = [mw_layer];

    var term_info = readTermLayer(term_layer, mw_layer, token_data);
    var predicates = readSRLLayer(srl_layer, typicality);
    var coreferences = readCoreferencesLayer(coref_layer);

    return { 'name': doc_name, 'source': source, 'title': 'test',
                'body': term_info, 'frames': predicates[0],
                'frame_elements': predicates[1], 'coreferences': coreferences } 
}

/**
 * Load a single NAF file into a json object
 * @param {string}      filename    The name of the naf file to load
 * @param {boolean}     adapt       Set to true if output format should be info
 * @param {callback}    callback    Function to call when done loading file
 */
function loadNAFFile(filename, inc_type, adapt, data_dir, callback) {
    if (data_dir == false) {
        data_dir = '';
    } else {
        data_dir = NAF_DIR;
    }

    // Check annotated version first
    file_path = data_dir + filename + '.naf';

    fs.readFile(file_path, 'utf-8', function(error, data) {
        var json = xmlParser.parse(data, xmlOptions);

        if (adapt) {
            callback(readNAFFile(json, filename, inc_type));
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
// function loadMultipleNAFs(nafs, callback){
//     var result = [];

//     // Load each NAF file and return if all files are loaded
//     for (var i = 0; i < nafs.length; i++) {
//         loadNAFFile(nafs[i], true, function(json_data) {
//             result.push(json_data);

//             // Call callback when ready
//             if (result.length == nafs.length) {
//                 callback(result);
//             }
//         });
//     }
// }
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

    references.push({ 'attr': reference_data });
    object['externalReferences']['externalRef'] = references;
    return object;
}

//#region Markable correction
function addMultiwordEntry(json_data, multiword_data) {
    json_data['NAF'] = createLayerIfNotExists(json_data['NAF'], 'multiwords', 'mw');
    var mw_layer = json_data['NAF']['multiwords']['mw'];
    if (!Array.isArray(mw_layer)) mw_layer = [mw_layer];

    multiword_data['mcn_type'] = multiword_data['mcn_type'] == 1 ? 'phrasal' : 'idiom';
    var pos = multiword_data['mcn_type'] == 'phrasal' ? 'VERB' : '';

    // Prepare multiword entry creation
    var multiword_id = 'mw' + (mw_layer.length + 1).toString();
    var multiword_entry = { 'attr': { 'id': multiword_id,
                                      'type': multiword_data['mcn_type'],
                                      'lemma': multiword_data['lemma'],
                                      'pos': pos },
                            'component': []};
    
    if (pos == '') { delete multiword_entry['attr']['pos'] }

    // Add each target term to component layer of multiword entry
    var target_ids = multiword_data['target_ids'];
    for (var i in target_ids) {
        var c_id = parseInt(i) + 1;
        var component_id = multiword_id + '.c' + c_id.toString();
        var target_term_id = target_ids[i];
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

    var srl_layer = json_data['NAF']['srl']['predicate'];
    if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];

    for (var i in srl_layer) {
        var predicate = srl_layer[i];
        var predicate_span = predicate['span']['target'];

        for (j in predicate_span) {
            var term = predicate_span[j];
            if (term in target_term_ids) {
                delete srl_layer[i];
            }
        }
    }

    json_data['NAF']['terms']['term'] = term_layer;
    json_data['NAF']['srl']['predicate'] = srl_layer;
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
            var offset = parseInt(token['attr']['offset']);

            token_layer[i]['subtoken'] = [];

            for (var j in compound_data['subterms']) {
                var subterm = compound_data['subterms'][j];
                var subterm_length = subterm['length'];
                var subterm_cdata = subterm['cdata'];
                var subtoken_id = token_id + '.sub' + j;

                var subtoken_entry = { 'attr': { 'id': subtoken_id,
                                                 'length': subterm_length,
                                                 'offset': offset,
                                               },
                                       '#cdata': subterm_cdata }
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

    var srl_layer = json_data['NAF']['srl']['predicate'];
    if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];

    for (var i in srl_layer) {
        var predicate = srl_layer[i];
        var predicate_span = predicate['span']['target'];

        for (j in predicate_span) {
            var term = predicate_span[j];
            if (term == target_id) {
                delete srl_layer[i];
            }
        }
    }

    json_data['NAF']['srl']['predicate'] = srl_layer;
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
            target_id = term_layer[i]['span']['target']['attr']['id'].toString();

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

    json_data['NAF']['text']['wf'] = token_layer;
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
                            'externalReferences': { 'externalRef': [] }};
    
    // Construct span layer
    var target_data = { 'attr': { 'id': predicate_data['target_term'] }};
    predicate_entry['span']['target'].push(target_data);

    var timestamp = new Date().toNAFUTCString();
    
    // Construct external references layer in predicate
    var reference_data = { 'reference': predicate_data['frame'],
                           'resource': 'http://premon.fbk.eu/premon/fn17',
                           'timestamp': timestamp,
                           'source': session_id,
                           'lu_url': predicate_data['lu'],
                           'reftype': predicate_data['type'] };
    predicate_entry = addExternalReferences(predicate_entry, reference_data);

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
            srl_layer[i]['attr']['status'] = 'deprecated';
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
            if (!('role' in predicate)) {
                predicate['role'] = [];
            }

            var role_layer = predicate['role'];
            if (!Array.isArray(role_layer)) role_layer = [role_layer];
            
            // Construct role entry
            var role_id = 'r' + (role_layer.length + 1).toString();
            var role_entry = { 'attr': { 'id': role_id, 'status': 'manual' },
                               'span': { 'target': [] },
                               'externalReferences': { 'externalRef': [] }};
            
            // Construct span layer
            if (role_data['target_terms'] != 'unexpressed') {
                for (var j in role_data['target_terms']) {
                    var target =  role_data['target_terms'][j];
                    var target_data = { 'attr': { 'id': target }};
                    role_entry['span']['target'].push(target_data);
                }
            }

            // Construct external references layer in role
            var reference_data = { 'reference': role_data['role'],
                                   'resource': 'http://premon.fbk.eu/premon/fn17',
                                   'timestamp': new Date().toNAFUTCString(),
                                   'source': session_id,
                                   'reftype': '' }
            role_entry = addExternalReferences(role_entry, reference_data)

            // Store result in json_data
            role_layer.push(role_entry);
            srl_layer[i]['role'] = role_layer;
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
            if (!Array.isArray(role_layer)) {
                role_layer = [role_layer];
                srl_layer[i]['role'] = [srl_layer[i]['role']];
            }

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
    for (var i in coreference_data['target_terms']) {
        var target_data = { 'attr': { 'id': coreference_data['target_terms'][i] }};
        correference_entry['span']['target'].push(target_data);
    }

    // Construct external references layer in coreference
    var reference_data = { 'reference': coreference_data['reference'],
                           'resource': 'http://www.wikidata.org',
                           'timestamp': new Date().toNAFUTCString(),
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
            coref_layer[i]['attr']['status'] = 'deprecated';
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
function handleMarkableCorrection(json_data, task_data) {
    // Add markable correction
    if (task_data.mcn_task == 1) {
        if (task_data.mcn_type == 1 || task_data.mcn_type == 2) {
            json_data, mw_id = addMultiwordEntry(json_data, task_data);
            return updateMultiwordTerms(json_data, mw_id, task_data['target_ids'])
        } else if (task_data.mcn_type == 3) {
            json_data, t_id = addCompoundEntry(json_data, task_data);
            return updateCompoundTokens(json_data, t_id, task_data)
        }
    }
    
    // Remove markable corrections
    else if (task_data.mcn_task == 2) {
        if (task_data.mcn_type == 1) {
            return deprecateMultiwordEntry(json_data, task_data['target_id']);
        } else if (task_data.mcn_type == 2) {
            return removeCompoundEntry(json_data, task_data['target_id']);
        }
    }

    // TODO: Handle incorrect task data with error
}

function handleFrameAnnotation(json_data, task_data, session_id) {
    if (task_data.fan_task == 1) {
        var srl_layer = json_data['NAF']['srl']['predicate'];
        if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];
        var timestamp = new Date().toNAFUTCString();

        for (var i in srl_layer) {
            var predicate = srl_layer[i];
            var predicate_id = predicate.attr.id;

            if (task_data.target_ids.includes(predicate_id)) {
                var reference_data = getLatestExternalReference(predicate.externalReferences.externalRef);
                reference_data['timestamp'] = timestamp;
                reference_data['source'] = session_id;
                
                srl_layer[i] = addExternalReferences(predicate, reference_data);
                srl_layer[i]['attr']['status'] = 'manual';
            }
        }
    } else if (task_data.fan_task == 2) {
        json_data['NAF'] = createLayerIfNotExists(json_data['NAF'], 'srl', 'predicate');
        var srl_layer = json_data['NAF']['srl']['predicate'];
        if (!Array.isArray(srl_layer)) srl_layer = [srl_layer];

        var timestamp = new Date().toNAFUTCString();

        if (task_data['lu'] == '') {
            task_data['lu'] = dynamicLexicalLookup(task_data['lem'],
                                                   task_data['pos'],
                                                   task_data['frame']);
        } 

        // Check for span overlap & update where necessary
        for (var i in srl_layer) {
            var predicate = srl_layer[i];
            var predicate_target = predicate['span']['target'];
            var predicate_target_id = predicate_target['attr']['id'];
            var target_index = task_data['target_ids'].indexOf(predicate_target_id);

            if (target_index > -1) {
                task_data['target_ids'].splice(target_index, 1);
                var reference_data = { 'reference': task_data['frame'],
                                       'resource': 'http://premon.fbk.eu/premon/fn17',
                                       'timestamp': timestamp,
                                       'source': session_id,
                                       'lu_url': task_data['lu'],
                                       'reftype': task_data['type'] };
                srl_layer[i] = addExternalReferences(predicate, reference_data);
                srl_layer[i]['attr']['status'] = 'manual';
            }
        }

        // Update overlap
        json_data['NAF']['srl']['predicate'] = srl_layer;

        // Create new predicate for each term in selected
        for (var i in task_data['target_ids']) {
            var predicate_data = { 'frame': task_data['frame'],
                                   'type': task_data['type'],
                                   'lu': task_data['lu'],
                                   'target_term': task_data['target_ids'][i] };
            json_data = addPredicateEntry(json_data, predicate_data, session_id);
        }
    } else if (task_data.fan_task == 3) {
        for (var i in task_data.target_ids) {
            var target_id = task_data.target_ids[i];
            json_data = deprecatePredicateEntry(json_data, target_id);
        }
    } 

    return json_data;
}

function handleFrameElementAnnotation(json_data, task_data, session_id) {
    if (task_data.fea_task == 1) {
        if (task_data['target_ids'] == 'unexpressed') {
            task_data['target_ids'] = ['unexpressed'];
        }

        var role_data = { 'role': task_data['role'], 'target_terms': task_data['target_ids'] };
        json_data = addRoleEntry(json_data, task_data['pr_id'], role_data, session_id);

        return json_data;
    } else if (task_data.fea_task == 2) {
        json_data = deprecateRoleEntry(json_data, task_data.pr_id, task_data.role);

        return json_data;
    }
}

function handleCoreferenceAnnotation(json_data, task_data, session_id) {
    if (task_data.cor_task == 1) {
        json_data['NAF'] = createLayerIfNotExists(json_data['NAF'], 'coreferences', 'coref');
        var coref_layer = json_data['NAF']['coreferences']['coref'];
        if (!Array.isArray(coref_layer)) coref_layer = [coref_layer];

        // Check for span overlap on different wikidata reference
        // for (var i in coref_layer) {
        //     var coref = coref_layer[i];
        //     var coref_target = coref['span']['target'];

        //     if (coref_target['attr']['id'] in task_data['target_ids']) {
        //         coref_layer[i]['status'] = 'deprecated';
        //         break;
        //     }
        // }

        // json_data['NAF']['coreferences']['coref'] = coref_layer;

        // Create new coreference entry for each term in selected
        // for (var i in task_data['target_ids']) {
        //     var coreference_data = {
        //         'reference': task_data['reference'],
        //         'type': task_data['type'],
        //         'target_term': task_data['target_ids'][i]
        //     };

        //     json_data = addCoreferenceEntry(json_data, coreference_data, session_id);
        // }

        var coreference_data = {
            'reference': task_data['reference'],
            'type': task_data['type'],
            'target_terms': task_data['target_ids']
        };

        json_data = addCoreferenceEntry(json_data, coreference_data, session_id);

        return json_data
    } else if (task_data.cor_task == 2) {
        json_data = deprecateCoreferenceEntry(json_data, task_data.coreference);
        
        return json_data;
    }
}

function handleStructuredDataAnnotation(incident_id, task_data) {
    var relation = task_data['relation'];

    if (task_data['action'] == '1') {
        // Add wdt item to inc2str
        var item = task_data['wdt_uri'] + ' | ' + task_data['label'];

        if (!(relation in inc2str[incident_id])) {
            inc2str[incident_id][relation] = [];
        }

        inc2str[incident_id][relation].push(item);
    } else {
        // Remove wdt item from inc2str
        var item = task_data['item'];

        var index = inc2str[incident_id][relation].indexOf(item);
        if (index !== -1) inc2str[incident_id][relation].splice(index, 1);
    }

    // Store inc2str
    fs.writeFile(inc2str_file, JSON.stringify(inc2str), function() {});
}
//#endregion

// =====================================
// Get the frame elements for a specific frame type
// Parameters: string, callback
var getFrameElements = function(frame_id) {
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

    return { "Core": core_elements, "Peripheral": peripheral_elements, "Extra-thematic": extra_thematic_elements, "Core-unexpressed": core_unexpressed_elements };
}

// TODO: Refactor needed
var saveSessionInfo = function(jsonData, sessionId, annotator, loginTime){
    var actionTime=new Date().toNAFUTCString();
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

var saveNAF = function(file_name, json_data, callback) {
    var parser = new jsonParser(jsonOptions);
    var xml = parser.parse(json_data);

    libxml.loadXmlFromString(xml);
    libxml.validateAgainstDtds();

    if (libxml.hasOwnProperty('validationDtdErrors')) {
        callback(libxml.validationDtdErrors);
    }

    libxml.freeXml();

    fs.writeFile(file_name, xml, function(err, data) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            callback(false);
        }
    });
}

// =====================================
// DYNAMIC LEXCION =====================
// =====================================
function storeDynamicLexicon(callback) {
    data = JSON.stringify(DynamicLexicon);
    fs.writeFile('data/DynamicLexicon.json', data, function(err, data) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            callback(false);
        }
    });
}

function dynamicLexicalLookup(lemma, pos, frame) {
    var namespace = 'http://rdf.cltl.nl/efn/fn_eng-lexicon-1.7-lu-';
    var new_id = (new Date()).getTime();

    var pos = posMap[pos];

    if (lemma in DynamicLexicon) {
        if (pos in DynamicLexicon[lemma]) {
            // LU ID already exists
            if (frame in DynamicLexicon[lemma][pos]) {
                storeDynamicLexicon(function(error) {
                    return DynamicLexicon[lemma][pos][frame];
                });
            }

            // Lemma and pos already exist, add frame and generate new ID
            DynamicLexicon[lemma][pos][frame] = namespace + new_id;
            storeDynamicLexicon(function(error) {
                return namespace + new_id;
            });
        }

        // Lemma already exist, add pos and generate new ID
        DynamicLexicon[lemma][pos] = {};
        DynamicLexicon[lemma][pos][frame] = namespace + new_id;
        storeDynamicLexicon(function(error) {
            return namespace + new_id;
        });
    }

    // Nothing exists, add lemma pos and generate new ID
    DynamicLexicon[lemma] = {};
    DynamicLexicon[lemma][pos] = {};
    DynamicLexicon[lemma][pos][frame] = namespace + new_id;
    storeDynamicLexicon(function(error) {
        return namespace + new_id;
    });
}

// =====================================
// QUERY ENDPOINTS =====================
// =====================================
// TODO: Validate all data is provided in request
app.post('/store_annotation', isAuthenticated, function(req, res) {
    var user = req.user.user;
    var login_time = req.session.visited;

    if (req.body['lan'] == 'None' || req.body['doc'] == 'None' ||
        req.body['tid'] == 'None' || req.body['tda'] == 'None') {
        res.sendStatus(400);
        return
    }

    var inc = req.body['inc'];
    var lan = req.body['lan'];
    var doc = req.body['doc'];
    var tid = parseInt(req.body['tid']);
    var tda = req.body['tda'];

    if (tid == 5) {
        handleStructuredDataAnnotation(inc, tda);
        res.sendStatus(200);
    } else {
        // Load NAF file for editing
        loadNAFFile(lan + '/' + doc, '', false, true, function(json_data) {
            if (tid == 1) {
                json_data = handleMarkableCorrection(json_data, tda);
            } else if (tid == 2) {
                json_data = handleFrameAnnotation(json_data, tda, req.sessionID);
                json_data = saveSessionInfo(json_data, req.sessionID, user, login_time);
            } else if (tid == 3) {
                json_data = handleFrameElementAnnotation(json_data, tda, req.sessionID);
                json_data = saveSessionInfo(json_data, req.sessionID, user, login_time);
            } else if (tid == 4) {
                json_data = handleCoreferenceAnnotation(json_data, tda);
            } else {
                // TODO: Handle invalid task
            }

            saveNAF(NAF_DIR + lan + '/' + doc + '.naf', json_data, function(error) {
                if (error) {
                    console.error('Error while saving NAF: ' + error);
                    res.sendStatus(400).json({ "error": error });
                } else {
                    console.log("Successfully saved annotation");
                    res.sendStatus(200);
                }
            });
        });
    }
});

// Endpoint to get all projects and incident types
app.get("/projects", isAuthenticated, function(req, res) {
    // Get projects and types
    var proj = Object.keys(proj2inc);
    var type = Object.keys(type2inc);

    var proj_res = Array.from(proj).map(function(key) {
        return { 'label': key, 'value': key };
    });

    var type_res = Array.from(type).map(function(key) {
        return { 'label': labels[key], 'value': key };
    });

    // Return projects and types
    res.send({ "proj": proj_res, "type": type_res });
    res.status(200);
});

// Endpoint to get all incidents of a certain type in a project
app.get("/project_incidents", isAuthenticated, function(req, res) {
    // Get parameters
    var proj = req.query["proj"];
    var type = req.query['type'];

    // Get all incidents
    var p2i = Array.from(proj2inc[proj]);
    var t2i = Array.from(type2inc[type]);
    var intersect = _.intersection(p2i, t2i);

    var result = intersect.map(function(key) {
        return { 'label': labels[key], 'value': key };
    });

    // Return result
    res.send({ "inc": result });
    res.status(200);
});

// Endpoint to get all languages in a specific incident
app.get('/incident_languages', isAuthenticated, function(req, res) {
    // Get parameters
    var inc = req.query['inc'];

    // Get all languages
    var languages = Object.keys(inc2lang2doc[inc]).map(function(key) {
        return { 'label': key, 'value': key };
    });

    // Return result
    res.send({ 'lang': languages });
    res.status(200);
});

// Endpoint te get all documents in a specific language for an incident
app.get('/incident_documents', isAuthenticated, function(req, res) {
    // Get parameters
    var inc = req.query['inc'];
    var lan = req.query['lan'];

    // Get all languages
    var doc = Array.from(inc2lang2doc[inc][lan]);

    // Get all languages
    var result = doc.map(function(key) {
        return { 'label': key, 'value': key };
    });

    // Return result
    res.send({ 'doc': result });
    res.status(200);
});

// Endpoint to load an incident
app.get('/load_document', isAuthenticated, function(req, res) {
    // Check if incident is provided
    if (!req.query['typ'] || !req.query['inc'] || !req.query['doc']) {
        res.sendStatus(400);
        return
    }

    // Get naf files using parameters
    var typ = req.query['typ'];
    var inc = req.query['inc'];
    var doc = req.query['doc'];

    var locked = false;
    var date = new Date();
    var now = date.getTime();

    // Check if incident user tries to load locked document
    if (inc in LockedIncidents) {
        // Check if doc is locked by this user
        if (LockedIncidents[inc].user != req.user.user) {
            // Check if lock time already expired
            var lock_time = parseInt(LockedIncidents[inc].time);
            if (now - lock_time < LOCK_TIME * 60000) {
                locked = true;
            }
        }
    }

    if (!locked) {
        // Unclock any previously locked incident by user
        Object.keys(LockedIncidents).some(function(k) {
            if (LockedIncidents[k].user === req.user.user) {
                delete LockedIncidents[k];
            }
        });

        // Lock new incident
        LockedIncidents[inc] = { 'user': req.user.user, 'time': now };

        // Load NAF files and return
        loadNAFFile(doc, typ, true, true, function(data) {
            res.send({ 'naf': data })
            res.status(200);
        });
    } else {
        res.sendStatus(423);
    }
});

// Endpoint to get structured data for an incident (with user annotations)
app.get("/load_incident_data", isAuthenticated, function(req, res) {
    if (!req.query["inc"]) {
        res.sendStatus(400);
    } else {
        // Get query parameters
        var inc = req.query["inc"];
        res.send(inc2str[inc]);
        res.status(200);
    }
});

// Endpoint to get all frames
app.get('/frames', isAuthenticated, function(req, res) {
    if (!req.query['typ'] || !req.query['lan'] || !req.query['lem']) {
        res.sendStatus(400);
        return
    }

    var typ = req.query['typ'];
    var lan = req.query['lan'];
    var lem = req.query['lem'];
    var lexical_path = lan + '/' + typ + '.json';

    // Load lexical data
    fs.readFile(LL_DIR + lexical_path, 'utf8', function(err, data) {
        data = JSON.parse(data)
        var result = {};
        var occupied_frames = [];

        if (DynamicLexicon[lem]) {
            var lemma_data = DynamicLexicon[lem];
            for (pos in lemma_data) {
                var lemma_frames = [];
                var pos_data = lemma_data[pos];

                for (frame in pos_data) {
                    var frame_info = allFramesInfo[frame];
                    var label = frame_info['frame_label'] + ' (' + lem + '.' + pos + ') (User)'; 
                    var entry = { 'label': label,
                                  'value': frame,
                                  'lu': pos_data[frame],
                                  'framenet': frame_info['framenet_url'],
                                  'definition': frame_info['definition'] };
                    lemma_frames.push(entry);
                }

                result[pos] = lemma_frames;
            }
        }

        if (data['lexical_lookup'][lem]) {
            var lemma_data = data['lexical_lookup'][lem];

            // Gather data for selected lemma
            for (key in lemma_data) {
                if (key != 'all_frames') { 
                    var lemma_frames = [];
                    for (frame in lemma_data[key]) {
                        var cur_frame = lemma_data[key][frame];
                        var frame_info = allFramesInfo[cur_frame[2]];
                        var entry = { 'label': cur_frame[1],
                                      'value': cur_frame[2],
                                      'lu': cur_frame[3],
                                      'framenet': frame_info['framenet_url'],
                                      'definition': frame_info['definition'] };
                        occupied_frames.push(cur_frame[2]);
                        lemma_frames.push(entry);
                    }

                    if (!(key in result)) {
                        result[key] = [];
                    }

                    result[key] = result[key].concat(lemma_frames);
                }
            }
        }

        // Gather data for other frames
        result['Other'] = [];
        var ordered = data['ordered_frames'];
        for (frame in ordered) {
            var cur_frame = ordered[frame];
            if (!occupied_frames.includes(cur_frame[1])) {
                var frame_info = allFramesInfo[cur_frame[2]];
                var entry = { 'label': cur_frame[1],
                              'value': cur_frame[2],
                              'lu': '',
                              'framenet': frame_info['framenet_url'],
                              'definition': frame_info['definition'] };
                result['Other'].push(entry)
            }
        }

        res.send(result);
        res.status(200);
    });
});

// Endpoint to get frame elements of a specific frame
app.get('/frame_elements', isAuthenticated, function(req, res) {
    // Check if frame is provided
    if (!req.query["frame"]) {
        res.sendStatus(400);
    } else {
        res.send(getFrameElements(req.query["frame"]));
        res.status(200);
    }
});

// Endpoint to get frame elements of a specific frame
app.post('/multi_frame_elements', isAuthenticated, function(req, res) {
    // Check if frame is provided
    if (!req.body["frames"]) {
        res.sendStatus(400);
    } else {
        var frames_info = {};

        for (var i in req.body['frames']) {
            var frame = req.body['frames'][i];
            frames_info[frame] = getFrameElements(frame);
        }

        res.send(frames_info);
        res.status(200);
    }
});

app.get('/pos_info', isAuthenticated, function(req, res) {
    res.send(Object.keys(posInfo))
    res.status(200);
});

// =====================================
// START THE SERVER ====================
// =====================================

app.listen(PORT, function() {
    console.log('started annotation tool nodejs backend on port ' + PORT);
});

// module.exports = { app, loadNAFFile, loadMultipleNAFs, saveNAF, handleMarkableCorrection, handleFrameAnnotation, handleFrameElementAnnotation, handleCoreferenceAnnotation };
