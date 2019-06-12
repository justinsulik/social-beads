# social-beads

In the interests of Open Science, we are making our experiment materials (for the project described at [https://osf.io/9f2ks/](https://osf.io/9f2ks/)) public here. A working demo of this task can be found at [https://cryptic-headland-48158.herokuapp.com](https://cryptic-headland-48158.herokuapp.com). 

We assume that most people interested in our experiment will be psychology researchers, who won't necessarily have experience with full-stack apps, and who might thus be unsure how to use the script, beyond just downloading these files. Thus, we'd like to be explicit about the following.

The main aim here is to share the full code for the experiment. Thus, we haven't deleted or altered lines of code that require external components, even though this means that the script won't run right out the box, since downloading these files won't install those external components. 

For instance, the file `app.js` (among others) includes code for opening a connection to a database. If you just downloaded this file and tried to run it (e.g. with `node app.js`), it would crash immediately, because it wouldn't be able to connect to a database unless you specifically set one up. Thus, if you wanted to run the script locally, there are several things you would need to set up first, *in addition to* cloning this repo.

These steps include:

1) Installing `node` and `npm`.
2) Setting up an account at heroku.com, and installing the Heroku CLI tool.
3) Installing the relevant node packages.
4) Initializing a Heroku app in the cloned folder.
5) Adding on a Mongodb database with the Heroku CLI tool.
6) Providing the app with a URI for the database.

Some useful CLI commands for steps 3-6 are as follows (assuming you already have a local git clone of this repo set up, and have navigated into the relevant folder). 

Install the relevant node packages.
```
npm install
```

Before setting up the Heroku app, tell git to ignore some files (so that they aren't accidentally shared). These include a file called `.env` which will ultimately store important information, like the path to access the Mongo database. 
```
touch .gitignore 
echo 'node_modules' >> .gitignore
echo 'npm-debug.log' >> .gitignore
touch .env
echo '.env' >> .gitignore
```
Then initialize the Heroku app.
```
heroku login
heroku create
```

Tell Heroku to provision the app with a Mongo database.
```
heroku addons:create mongolab:sandbox
```

Then save the URI for this database to the `.env` file.
```
heroku config:get MONGODB_URI | awk '{print "MONGODB_URI="$1}' >> .env
```


Assuming the above has worked without error, you can then try run the script with the command
```
heroku local webL
```
