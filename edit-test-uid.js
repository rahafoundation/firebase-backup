import * as firebase from 'firebase';
import 'firebase/firestore';

async function main() {
    const args = process.argv;

    if (args.length !== 7) {
        throw Error('Usage is "npm run edit-test-uid memberUsername memberPublicPin newUid, e.g. mark.ulrich 2777 vJle6l4K3jdEBk5CvZK4RYyxpFI2"');
    }

    const memberId = args[4] + '$' + args[5];
    const newUid = args[6];
    const config = require('./firebase.test.config.json');

    const changeMsg = `member ID ${memberId} to uid ${newUid} in ${config.projectId}`;

    console.log(`Going to change ${changeMsg}`);

    const app = firebase.initializeApp(config);
    const db = app.firestore();
    const numEdits = await db.runTransaction(async tx => {
        const membersRef = db.collection('members');
        const opsRef = db.collection('operations');
        const origMember = await membersRef.where('mid', '==', memberId).get();
        const numOrig = origMember.docs.length;
        if (numOrig !== 1) {
            throw Error(`Found ${numOrig} members with mid of ${memberId}, but expected exactly 1`);
        }
        const ops_created_by_orig = await opsRef.where('creator_mid', '==', memberId).get();
        const ops_to_orig = await opsRef.where('data.to_mid', '==', memberId).get();
        tx.set(membersRef.doc(newUid), {...origMember.docs[0].data(), ...{uid: newUid}});
        tx.delete(membersRef.doc(origMember.docs[0].id));
        await Promise.all(ops_created_by_orig.docs.map(d => tx.update(opsRef.doc(d.id), {creator_uid: newUid})));
        await Promise.all(ops_to_orig.docs.map(d => tx.update(opsRef.doc(d.id), {'data.to_uid': newUid})));
        return 1 + ops_created_by_orig.docs.length + ops_to_orig.docs.length;
    });

    console.log(`Set ${changeMsg} in ${numEdits} places`);
    process.exit();
}

main();
