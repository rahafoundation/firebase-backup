import * as path from "path";

import * as admin from "firebase-admin";

export function getDb(pathToFbKey: string, projectId: string) {
  const firebaseKey = require(path.resolve(
    path.join(process.cwd(), pathToFbKey)
  ));
  if (firebaseKey.project_id !== projectId) {
    throw Error(
      `Gave projectId ${projectId} but path to firebase key credentials was for ${
        firebaseKey.project_id
      }`
    );
  }
  const app = admin.initializeApp({
    credential: admin.credential.cert(firebaseKey),
    databaseURL: `https://${firebaseKey.project_id}.firebaseio.com`
  });
  return app.firestore();
}
