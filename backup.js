import * as firebase from 'firebase';
import 'firebase/firestore';
import fs from 'fs';

firebase.initializeApp(require('./firebase.config.json'));
const auth = firebase.auth();
const db = firebase.firestore();

const queries = {
    'operations': db.collection('operations'),
    'members': db.collection('members'),
    'relations': db.collection('relations'),
    'user_data': db.collection('user_data')
};

let queriesCompleted = 0;

Object.entries(queries).forEach((nmQry) => {
    let [name, query] = nmQry;
    query.get().then(function(snap) {
        let data = snap.docs.map(x => JSON.stringify(x.data()) );
        fs.writeFile('./backup.' + name + '.json', data.join('\n'), (err) => {
            if (err) console.error(err);
            else console.log(data.length + ' records written for ' + name + '.')

            // Teminate after having completed all queries.
            if (++queriesCompleted >= Object.keys(queries).length) {
                process.exit();
            }
        });
    });
});
