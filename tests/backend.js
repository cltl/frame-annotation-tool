const assert = require('assert');
const tool = require('../tool');

const TEST_FILE_DIR = 'data/TestData/' 
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
    tool.loadNAFFile(input_file, false, false, function(input) {
        tool.loadNAFFile(expected_file, false, false, function(expected) {
            removeKeys(input, VARIABLE_KEYS);
            removeKeys(expected, VARIABLE_KEYS);
            assert.deepStrictEqual(input, expected);
            done();
        });
    });
}

describe('Document loading test', () => {
    it('Should load NAF document in JSON format', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/mcn_cre_phv', false, false, function(result) {
            assert.notStrictEqual(result, undefined)
            done();
        });
    });
});

describe('Markable correction tests', () => {
    it('Should create wellformed phrasal verb', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/mcn_cre_phv', false, false, function(result) {
            task_data = { 'mcn_type': 1,
                          'mcn_task': 1,
                          'lemma': 'aandoen',
                          'target_ids': ['t3', 't5'] };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF(TEST_FILE_DIR + 'actual/mcn_cre_phv.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/mcn_cre_phv', TEST_FILE_DIR + 'expected/mcn_cre_phv', done);
            });
        });
    });

    it('Should create wellformed idiom', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/mcn_cre_idi', false, false, function(result) {
            task_data = { 'mcn_type': 2,
                          'mcn_task': 1,
                          'lemma': 'a blessing in disguise',
                          'target_ids': ['t3', 't4', 't5', 't6'] };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF(TEST_FILE_DIR + 'actual/mcn_cre_idi.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/mcn_cre_idi', TEST_FILE_DIR + 'expected/mcn_cre_idi', done);
            });
        });
    });

    it('Should create wellformed compound term', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/mcn_cre_cpt', false, false, function(result) {
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

            tool.saveNAF(TEST_FILE_DIR + 'actual/mcn_cre_cpt.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/mcn_cre_cpt', TEST_FILE_DIR + 'expected/mcn_cre_cpt', done);
            });
        });
    });

    it('Should deprecate phrasal verb', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/mcn_rem_phv', false, false, function(result) {
            task_data = { 'mcn_type': 1,
                          'mcn_task': 2,
                          'target_id': 'mw1' };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF(TEST_FILE_DIR + 'actual/mcn_rem_phv.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/mcn_rem_phv', TEST_FILE_DIR + 'expected/mcn_rem_phv', done);
            });
        });
    });

    it('Should deprecate idiom', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/mcn_rem_idi', false, false, function(result) {
            task_data = { 'mcn_type': 1,
                          'mcn_task': 2,
                          'target_id': 'mw1' };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF(TEST_FILE_DIR + 'actual/mcn_rem_idi.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/mcn_rem_idi', TEST_FILE_DIR + 'expected/mcn_rem_idi', done);
            });
        });
    });

    it('Should remove compound', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/mcn_rem_cpt', false, false, function(result) {
            task_data = { 'mcn_type': 2,
                          'mcn_task': 2,
                          'target_id': 't2' };
            new_json = tool.handleMarkableCorrection(result, task_data);

            tool.saveNAF(TEST_FILE_DIR + 'actual/mcn_rem_cpt.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/mcn_rem_cpt', TEST_FILE_DIR + 'expected/mcn_rem_cpt', done);
            });
        });
    });
});

describe('Frame annotation test', () => {
    it('Should create wellformed predicate', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/fra_cre', false, false, function(result) {
            task_data = { 'frame': 'http://premon.fbk.eu/resource/fn17-killing',
                          'type': 'type',
                          'target_ids': ['t3'],
                          'has_lu': false,
                          'lu': undefined,
                          'lu_resource': undefined };
            new_json = tool.handleFrameAnnotation(result, task_data);

            tool.saveNAF(TEST_FILE_DIR + 'actual/fra_cre.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/fra_cre', TEST_FILE_DIR + 'expected/fra_cre', done);
            });
        });
    });

    it('Should update predicate', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/fra_upd', false, false, function(result) {
            task_data = { 'frame': 'http://premon.fbk.eu/resource/fn17-erasing',
                          'type': 'type',
                          'target_ids': ['t3'],
                          'has_lu': false,
                          'lu': undefined,
                          'lu_resource': undefined };
            new_json = tool.handleFrameAnnotation(result, task_data);

            tool.saveNAF(TEST_FILE_DIR + 'actual/fra_upd.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/fra_upd', TEST_FILE_DIR + 'expected/fra_upd', done);
            });
        });
    });

    it('Should deprecate predicate', (done) => {
        tool.loadNAFFile(TEST_FILE_DIR + 'input/fra_rem', false, false, function(result) {
            task_data = { };
            new_json = tool.handleFrameAnnotation(result, task_data);

            tool.saveNAF(TEST_FILE_DIR + 'actual/fra_rem.naf', new_json, function() {
                assertNAFsEqual(TEST_FILE_DIR + 'actual/fra_rem', TEST_FILE_DIR + 'expected/fra_rem', done);
            });
        });
    });
});
