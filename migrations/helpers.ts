import * as path from "path";

import * as admin from "firebase-admin";
import {
  Query,
  QueryDocumentSnapshot,
  CollectionReference
} from "@google-cloud/firestore";

export function getDb(pathToFbKey: string, projectId: string) {
  const firebaseKey = require(pathToFbKey[0] == "/"
    ? pathToFbKey
    : path.resolve(path.join(process.cwd(), pathToFbKey)));
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

export async function fetchEntireCollection(
  collection: CollectionReference
): Promise<QueryDocumentSnapshot[]> {
  let backup: any[] = [];
  let curCollectionView: Query = collection;
  let docs: QueryDocumentSnapshot[] = [];
  while (true) {
    const snapshot = await curCollectionView.get();
    const fetchSize = snapshot.docs.length;
    if (fetchSize === 0) break;
    console.log(`Fetched ${fetchSize}`);
    docs = docs.concat(snapshot.docs as QueryDocumentSnapshot[]);
    const last = snapshot.docs[snapshot.docs.length - 1];
    curCollectionView = collection.startAfter(last);
  }
  return docs;
}
