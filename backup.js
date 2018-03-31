import bluebird from 'bluebird';
import firebase from 'firebase';
import 'firebase/firestore';
import fs from 'fs';

const writeFile = bluebird.promisify(fs.writeFile);

firebase.initializeApp(require('./firebase.prod.config.json'));
const auth = firebase.auth();
const db = firebase.firestore();

const queries = {
    'operations': db.collection('operations'),
    'members': db.collection('members'),
};

async function storeQueryResult(nameAndQuery) {
    let [name, query] = nameAndQuery;
    let backup = [];
    while (true) {
        let snap = await query.get();
        let fetchSize = snap.docs.length;
        if (fetchSize === 0) break;
        console.log(`Fetched ${fetchSize} from ${name}`);
        let data = snap.docs.map(x => JSON.stringify({
            id: x.id,
            data: x.data(),
        }));
        backup = backup.concat(data);
        let last = snap.docs[snap.docs.length - 1];
        query = query.startAfter(last);
    }
    await writeFile('./backup.' + name + '.json', backup.join('\n'));
    console.log(`${backup.length} records written for ${name}.`);
}

async function storeAllQueries() {
    await Promise.all(Object.entries(queries).map(storeQueryResult));
    process.exit();
}

storeAllQueries();
