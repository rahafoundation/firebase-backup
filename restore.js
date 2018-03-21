import readline from 'readline';

import * as firebase from 'firebase';
import 'firebase/firestore';
import fs from 'fs';

function restoreDatabase() {
    firebase.initializeApp(require('./firebase.test.config.json'));
    const auth = firebase.auth();
    const db = firebase.firestore();

    const queries = {
        'operations': db.collection('operations'),
        'members': db.collection('members'),
    };

    let queriesCompleted = 0;
    const queriesToComplete = Object.keys(queries).length;

    Object.entries(queries).forEach((nmQry) => {
        let [name, query] = nmQry;
        const backupFilename = `./backup.${name}.json`;

        new Promise((resolve) => {
            fs.readFile(backupFilename, 'utf8', function(err, data) {
                if (err) throw err;
                const objects = [];
                resolve(data.split('\n').map((object) => JSON.parse(object)));
            });
        }).then((fileJson) => {
            const totalToCreate = fileJson.length;
            let created = 0;
            fileJson.forEach((object) => {
                const { id, data } = object;
                query.doc(id).set(data).then(() => {
                    if (++created == totalToCreate) {
                        console.log(`Restored ${totalToCreate} objects to the ${name} collection.`);
                        if (++queriesCompleted == queriesToComplete) {
                            process.exit();
                        }
                    }
                });
            })
        });
    });
}

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Exit if the input is not 'y'.
 */
function confirm(answer) {
    if (answer === 'y') return true;
    process.exit();
};

async function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(confirm(answer));
        })
    });
}

async function promptRestoreDatabase() {
    rl.write('This will destroy all data in the test database and restore it from your local backup of the prod db.\n');
    await prompt('Do you have a local backup of the prod db? (If not, run `npm run backup`) (y/n) ');
    await prompt('Are you sure you want to delete and restore the test database? (y/n) ');
    restoreDatabase();
}

promptRestoreDatabase();
