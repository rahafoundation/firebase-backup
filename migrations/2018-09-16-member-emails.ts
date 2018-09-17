import * as fs from "fs";
import * as util from "util";
import { getDb, fetchEntireCollection } from "./helpers";
import { Firestore } from "@google-cloud/firestore";

const readFileAsync = util.promisify(fs.readFile);

const EMAIL_FIELD = "email_address";

async function getMemberIdNoEmail(db: Firestore): Promise<string[]> {
  const memberDocs = await fetchEntireCollection(db.collection("members"));
  const memberIdNoEmail = memberDocs
    .filter(d => {
      const email = d.get(EMAIL_FIELD);
      return !email || email.indexOf("@") === -1;
    })
    .map(d => d.id);
  console.info(
    `Found ${memberIdNoEmail.length} / ${
      memberDocs.length
    } of members without emails`
  );
  return memberIdNoEmail;
}

async function getMemberIdToEmail(pathToEmails: string) {
    console.log(`Reading auth file from ${pathToEmails}`);
    // Get this file by running firebase auth:export --format=csv
    const emailCsv = await readFileAsync(pathToEmails, "utf8");
    const memberIdToEmail: { [index: string]: string } = {};
    emailCsv.split("\n").forEach(s => {
      const frags = s.split(",");
      const memberId = frags[0];
      const email = frags[1];
      if (memberId && email) {
        if (email.indexOf("@") === -1) {
          throw Error(`Bad email ${email}`);
        }
        memberIdToEmail[memberId] = email;
      }
    });
    return memberIdToEmail;
}

async function main() {
  const args = process.argv;
  try {
    const db = getDb(args[2], args[3]);
    const membersMissingEmails = await getMemberIdNoEmail(db);
    const memberIdToEmail = await getMemberIdToEmail(args[4]);
    let numSet = 0;
    const batch = db.batch();
    membersMissingEmails.forEach(memberId => {
        const email = memberIdToEmail[memberId];
        if (email) {
            batch.update(db.collection("members").doc(memberId), {[EMAIL_FIELD]: email, email_address_is_verified: true});
            numSet++;
        }
    });
    if (numSet > 500) {
      throw Error('Cannot set over 500 in single batch');
    }
    await batch.commit();
    console.info(`Added emails to ${numSet} of the ${membersMissingEmails.length} missing`);
    process.exit(0);
  } catch (err) {
    console.error("Adding emails failed.", err);
    process.exit(1);
  }
}

main();
