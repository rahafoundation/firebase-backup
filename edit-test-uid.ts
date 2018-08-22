/**
 * Use this script to change the member ID associated with a given username in the
 * test database. This is useful when using the test database in order to allow
 * logging into existing accounts with your Firebase credentials in the test
 * application, after the database has been restored.
 *
 * For example, could do:
 * npm run edit-test-uid mark.ulrich.2777 vJle6l4K3jdEBk5CvZK4RYyxpFI2 [path to your firebase key]
 *
 * to make all member and operations documents associated with mark.ulrich.2777 to have
 * uid vJle6l4K3jdEBk5CvZK4RYyxpFI2. This is useful because the firebase auth member IDs are
 * different in prod and test, so after logging in on test you can see your member ID in
 * the firebase authentication tab and then run this script to associate that test member ID
 * with a given username, so then you can log in as that member and view all
 * public data for debugging and development purposes.
 */
import * as admin from "firebase-admin";

/* =======
 * Helpers
 * =======
 */

async function changeUid(
  username: string,
  newMemberId: string,
  pathToFbKey: string
): Promise<void> {
  const firebaseKey = require(pathToFbKey);
  const projectId = "raha-test";
  if (firebaseKey.project_id !== projectId) {
    throw Error(
      `Must use project ${projectId} but path to firebase key credentials was for ${
        firebaseKey.project_id
      }`
    );
  }
  // TODO similar logic in migrations/member-usernames ideally should be more DRY
  const app = admin.initializeApp({
    credential: admin.credential.cert(firebaseKey),
    databaseURL: `https://${projectId}.firebaseio.com`
  });
  const db = app.firestore();
  const numEdits = await db.runTransaction(async tx => {
    const membersRef = db.collection("members");
    const opsRef = db.collection("operations");
    const origMembers = await membersRef
      .where("username", "==", username)
      .get();
    const numOrig = origMembers.docs.length;
    if (numOrig !== 1) {
      throw Error(
        `Found ${numOrig} members with username of ${username}, but expected exactly 1`
      );
    }
    const origMember = origMembers.docs[0];
    if (origMember.id === newMemberId) {
      throw Error("New member ID matches the old member ID.");
    }
    const ops_creator_uid = await opsRef
      .where("creator_uid", "==", origMember.id)
      .get();

    // Note: UID is the old name for member ID.
    const ops_to_uid = await opsRef
      .where("data.to_uid", "==", origMember.id)
      .get();

    const ops_request_from_member_id = await opsRef
      .where("data.request_invite_from_member_id", "==", origMember.id)
      .get();

    const ops_invited_member_id = await opsRef
      .where("data.invited_member_id", "==", origMember.id)
      .get();

    const members_invited_by_orig = await membersRef
      .where("request_invite_from_member_id", "==", origMember.id)
      .get();

    tx.set(membersRef.doc(newMemberId), {
      ...origMember.data()
    });
    tx.delete(membersRef.doc(origMember.id));
    await Promise.all(
      ops_creator_uid.docs.map(d =>
        tx.update(opsRef.doc(d.id), { creator_uid: newMemberId })
      )
    );
    await Promise.all(
      ops_to_uid.docs.map(d =>
        tx.update(opsRef.doc(d.id), { "data.to_uid": newMemberId })
      )
    );
    await Promise.all(
      ops_request_from_member_id.docs.map(d =>
        tx.update(opsRef.doc(d.id), {
          "data.request_invite_from_member_id": newMemberId
        })
      )
    );
    await Promise.all(
      ops_invited_member_id.docs.map(d =>
        tx.update(opsRef.doc(d.id), {
          "data.invited_member_id": newMemberId
        })
      )
    );
    await Promise.all(
      members_invited_by_orig.docs.map(d =>
        tx.update(membersRef.doc(d.id), {
          "data.request_invite_from_member_id": newMemberId
        })
      )
    );
    return (
      1 +
      ops_creator_uid.docs.length +
      ops_to_uid.docs.length +
      members_invited_by_orig.docs.length +
      ops_request_from_member_id.docs.length +
      ops_invited_member_id.docs.length
    );
  });

  console.log(`Set ${changeMsg} in ${numEdits} places`);
  process.exit();
}

/* ======
 * Script
 * ======
 */

const args = process.argv;

if (args.length !== 5) {
  console.error(
    'Usage is "yarn edit-test-uid username newMemberId pathToFbKey, e.g. mark.ulrich.2777 vJle6l4K3jdEBk5CvZK4RYyxpFI2 [path to your firebase key]". You provided:',
    args
  );
  process.exit(2);
}

const username = args[2];
const newMemberId = args[3];

const changeMsg = `username ${username} to member ID ${newMemberId}`;

console.log(`Going to change ${changeMsg}`);

changeUid(username, newMemberId, args[4])
  .then(() => {
    console.info("Setting member ID succeeded.");
    process.exit();
  })
  .catch(err => {
    console.error("Setting member ID failed.", err);
    process.exit(1);
  });
