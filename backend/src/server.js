import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import express from 'express';
import 'dotenv/config';
import { db, connectToDb } from './db.js';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const credentials = JSON.parse(
  fs.readFileSync('./credentials.json')
);

admin.initializeApp({
  credential: admin.credential.cert(credentials)
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../build')));

// regular expression for all the routes that don't start with api
// when a browser sends a request that isn't going to one of our routes 
// we send back html file which will load our react script and render our react app
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, '../build/index.html'));
});

app.use(async (req, res, next) => {
  const { authtoken } = req.headers;

  if(authtoken) {
    try {
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (error) {
      return res.sendStatus(400);
    }
  }

    req.user = req.user || {};
  next();
});

app.get('/api/articles/:name', async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;

  const collection = db.collection('articles');
  const article = await collection.findOne({ name });

  // If no article found, return 404
  if (article) {
    // check if user has already upvoted
    const upvoteIds = article.upvoteIds || [];
    article.canUpvote = uid && !upvoteIds.includes(uid);
    res.json(article);
  } else {
    return res.status(404).json({ message: 'Article not found' });
  }
});

app.use((req, res, next) => {
  if(req.user) {
    next();
  } else {
    res.sendStatus(401);
  }
})

app.put('/api/articles/:name/upvote', async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;
  const article = await db.collection('articles').findOne({ name });

  // If no article found, return 404
  if (article) {
    // check if user has already upvoted
    const upvoteIds = article.upvoteIds || [];
    const canUpvote = uid && !upvoteIds.includes(uid);

    if (canUpvote) {
      await db.collection('articles').updateOne({ name }, {
        $inc: { upvotes: 1 },
        $push: { upvoteIds: uid },
      });
    }
    
    const updatedArticle = await db.collection('articles').findOne({ name });
   
    res.json(updatedArticle);
    } else {
      res.json({ message: 'That article doesn\'t exist' });
    }
});

app.post('/api/articles/:name/comments', async (req, res) => {
  const { name } = req.params;
  const { text } = req.body;
  const { email } = req.user;

  await db.collection('articles').updateOne({ name },{
      $push: { comments: { postedBy: email, text } },
    }
  );

  const article = await db.collection('articles').findOne({ name });

  if (article) {
    res.json(article);
  } else {
    res.send('That article doesn\'t exists');
  }
});

// Allows hosting platform to specify which port to listen on
const PORT = process.env.PORT || 8000;

connectToDb(() => {
  console.log('Successfully connected to database');
  app.listen(PORT, () => {
    console.log('Server is listening on port' + PORT);
  });
});
