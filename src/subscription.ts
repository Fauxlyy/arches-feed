import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

const need1 = ['archesvn', 'camdev'];

const need2 = ['arches', 'vn',
                    ['cam', 'cameron', 'cammy'],
                    ['dev', 'devon'],
                    ['arturo', 'artie']];


export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        const text         = create.record.text.toLowerCase();
        let   isArchesPost = false

        if (this.includesStr(text, need1))
        {
          isArchesPost = true;
        }
        else
        {
          let matches = 0

          for (let i = 0; i < need2.length && matches < 2; i++)
          {
            const word    = need2[i];
            const isArray = Array.isArray(word);

            if ((isArray && this.includesStr(text, word)) || 
               (!isArray && this.containsWholeWord(text, word)))
            {
              matches++;
            }
          }

          if (matches >= 2)
          {
            isArchesPost = true;
          }
        }

        return isArchesPost;
      })
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }

  includesStr(text: string, arr: Array<string>): boolean
  {
    return arr.some(s => {
      return this.containsWholeWord(text, s);
    })
  }

  containsWholeWord(text: string, word: string): boolean
  {
    const regex = new RegExp(`(?:\\W|^)${word}(?:\\W|$)`);
    
    return regex.test(text);
  }
}
