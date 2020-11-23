const assert = require('assert');
const tool = require('../tool');

const VARIABLE_KEYS = ['nafHeader', 'timestamp', 'source']

// From: https://gist.github.com/aurbano/383e691368780e7f5c98#gistcomment-3072240
// Removes specified keys nested at some level in obj from obj
function removeKeys(obj, keys) {
    for (var prop in obj) {
        if(obj.hasOwnProperty(prop)) {
            switch(typeof(obj[prop])) {
                case 'object':
                    if(keys.indexOf(prop) > -1) {
                        delete obj[prop];
                    } else {
                        removeKeys(obj[prop], keys);
                    }
                    break;
              default:
                    if(keys.indexOf(prop) > -1) {
                        delete obj[prop];
                    }
                    break;
            }
        }
    }
}

function assertNAFsEqual(input_file, expected_file, done) {
    tool.loadNAFFile(input_file, false, function(input) {
        tool.loadNAFFile(expected_file, false, function(expected) {
            removeKeys(input, VARIABLE_KEYS);
            removeKeys(expected, VARIABLE_KEYS);
            assert.deepStrictEqual(input, expected);
            done();
        });
    });
}

describe('NAF document load test', () => {
    it('Should load NAF document in JSON format', (done) => {
        tool.loadNAFFile('test/inputs/mcn_cre_phv', false, function(result) {
            assert.notStrictEqual(result, undefined)
            done();
        });
    });
});

describe('Markable correction test', () => {
    it('Should create wellformed phrasal verb', (done) => {
        tool.loadNAFFile('test/inputs/mcn_cre_phv', false, function(result) {
            task_data = { 'mcn_type': 1,
                          'mcn_task': 1,
                          'lemma': 'aandoen',
                          'target_ids': ['t3', 't5'] };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF('data/naf/test/actual/mcn_cre_phv.naf', new_json, function() {
                assertNAFsEqual('test/actual/mcn_cre_phv', 'test/expected/mcn_cre_phv', done);
            });
        });
    });

    it('Should create wellformed idiom', (done) => {
        tool.loadNAFFile('test/inputs/mcn_cre_idi', false, function(result) {
            task_data = { 'mcn_type': 2,
                          'mcn_task': 1,
                          'lemma': 'a blessing in disguise',
                          'target_ids': ['t3', 't4', 't5', 't6'] };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF('data/naf/test/actual/mcn_cre_idi.naf', new_json, function() {
                assertNAFsEqual('test/actual/mcn_cre_idi', 'test/expected/mcn_cre_idi', done);
            });
        });
    });

    it('Should create wellformed compound term', (done) => {
        tool.loadNAFFile('test/inputs/mcn_cre_cpt', false, function(result) {
            task_data = { 'mcn_type': 3,
                          'mcn_task': 1,
                          'head': 2,
                          'subterms': [
                              { 'length': 9, 'cdata': 'president', 'lemma': 'president', 'pos': 'NOUN' },
                              { 'length': 1, 'cdata': 's', 'lemma': 's', 'pos': 'X' },
                              { 'length': 10, 'cdata': 'verkiezing', 'lemma': 'verkiezing', 'pos': 'NOUN' },
                          ]
                        };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF('data/naf/test/actual/mcn_cre_cpt.naf', new_json, function() {
                assertNAFsEqual('test/actual/mcn_cre_cpt', 'test/expected/mcn_cre_cpt', done);
            });
        });
    });

    it('Should deprecate phrasal verb', (done) => {
        tool.loadNAFFile('test/inputs/mcn_rem_phv', false, function(result) {
            task_data = { 'mcn_type': 1,
                          'mcn_task': 2,
                          'target_id': 'mw1' };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF('data/naf/test/actual/mcn_rem_phv.naf', new_json, function() {
                assertNAFsEqual('test/actual/mcn_rem_phv', 'test/expected/mcn_rem_phv', done);
            });
        });
    });

    it('Should deprecate idiom', (done) => {
        tool.loadNAFFile('test/inputs/mcn_rem_idi', false, function(result) {
            task_data = { 'mcn_type': 1,
                          'mcn_task': 2,
                          'target_id': 'mw1' };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF('data/naf/test/actual/mcn_rem_idi.naf', new_json, function() {
                assertNAFsEqual('test/actual/mcn_rem_idi', 'test/expected/mcn_rem_idi', done);
            });
        });
    });

    it('Should remove compound', (done) => {
        tool.loadNAFFile('test/inputs/mcn_rem_cpt', false, function(result) {
            task_data = { 'mcn_type': 2,
                          'mcn_task': 2,
                          'target_id': 't2' };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF('data/naf/test/actual/mcn_rem_cpt.naf', new_json, function() {
                assertNAFsEqual('test/actual/mcn_rem_cpt', 'test/expected/mcn_rem_cpt', done);
            });
        });
    });
});

describe('Frame annotation test', () => {
    it('Should create wellformed predicate', (done) => {
        tool.loadNAFFile('test/inputs/fra_cre', false, function(result) {
            task_data = { 'frame': 'http://premon.fbk.eu/resource/fn17-killing',
                          'type': 'type',
                          'target_ids': ['t3'],
                          'has_lu': false,
                          'lu': undefined,
                          'lu_resource': undefined };
            new_json = tool.handleFrameAnnotation(result, task_data);

            tool.saveNAF('data/naf/test/actual/fra_cre.naf', new_json, function() {
                assertNAFsEqual('test/actual/fra_cre', 'test/expected/fra_cre', done);
            });
        });
    });

    it('Should update predicate', (done) => {
        tool.loadNAFFile('test/inputs/fra_upd', false, function(result) {
            task_data = { 'frame': 'http://premon.fbk.eu/resource/fn17-erasing',
                          'type': 'type',
                          'target_ids': ['t3'],
                          'has_lu': false,
                          'lu': undefined,
                          'lu_resource': undefined };
            new_json = tool.handleFrameAnnotation(result, task_data);

            tool.saveNAF('data/naf/test/actual/fra_upd.naf', new_json, function() {
                assertNAFsEqual('test/actual/fra_upd', 'test/expected/fra_upd', done);
            });
        });
    });

    it('Should deprecate predicate', (done) => {
        tool.loadNAFFile('test/inputs/8', false, function(result) {
            task_data = { };
            new_json = tool.handleFrameAnnotation(result, task_data);

            tool.saveNAF('data/naf/test/actual/7.naf', new_json, function() {
                assertNAFsEqual('test/actual/7', 'test/expected/7', done);
            });
        });
    });
});
