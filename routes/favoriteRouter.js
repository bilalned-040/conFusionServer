var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var authenticate = require('../authenticate');
const cors = require('./cors');

var Favorites = require('../models/favorite');
var favoriteRouter = express.Router();
favoriteRouter.use(bodyParser.json());

favoriteRouter.route('/')
.options(cors.corsWithOptions, (req, res) => { res.sendStatus(200); })
.get(cors.cors, authenticate.verifyUser, (req,res,next) => {
    Favorites.findOne({ 'user': req.user._id})
    .populate('user')
    .populate('dishes')
    .then((favorites) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(favorites);
    }, (err) => next(err))
    .catch((err) => next(err));
})
.post(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    Favorites.findOne({'user': req.user._id}, (err, favorites) => {
        if (err) {
            return next(err);
        }
        // no document yet exists
        if (favorites == null) {
            Favorites.create( { 'user': req.user._id, 'dishes': req.body } )
            .then((favouriteDishes) => {
                Favorites.findById(favouriteDishes._id)
                    .populate('user')
                    .populate('dishes')
                    .then((favorite) => {
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.json(favorite);
                    })
            }, (err) => next(err))
            .catch((err) => next(err));
        }
        //some favourite dishes exist against this user already, let's update those
        else {
            // validate whether the favorites dishes sent by the user are already added to favorites or not
            var newFavorites = []
            Favorites.findOne(favorites._id)
            .then((favorites) => {
                for(var i = 0; i < req.body.length; i++) {
                    var favoriteObject = req.body[i]._id;
                    
                    if (favorites.dishes.indexOf(favoriteObject) !== -1) {
                        console.log("Dish Already Added in Database");
                    }
                    else {
                        newFavorites.push(favoriteObject);
                    }
                }

                // now let's send the filtered dishes list to the DB
                Favorites.findByIdAndUpdate(favorites._id, {
                    $push: {
                        'dishes': newFavorites
                    }
                },
                { upsert: true, new: true })
                .populate('user')
                .populate('dishes')
                .then((favouriteDishes) => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.json(favouriteDishes);
                }, (err) => next(err))
                .catch((err) => next(err));
            });
        }
    });
})
.put(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end('PUT operation not supported on /favorites');
})
.delete(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    Favorites.remove({'user': req.user._id})
    .then((resp) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(resp);
    }, (err) => next(err))
    .catch((err) => next(err));
})


favoriteRouter.route('/:dishId')
.options(cors.corsWithOptions, (req, res) => { res.sendStatus(200); })
.get(cors.cors, authenticate.verifyUser, (req,res,next) => {
    Favorites.findOne({user: req.user._id})
    .then((favorites) => {
        if (!favorites) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.json({"exists": false, "favorites": favorites});
        }
        else {
            if (favorites.dishes.indexOf(req.params.dishId) < 0) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                return res.json({"exists": false, "favorites": favorites});
            }
            else {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                return res.json({"exists": true, "favorites": favorites});
            }
        }

    }, (err) => next(err))
    .catch((err) => next(err))
})
.post(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    Favorites.findOne({'user': req.user._id}, (err, favorites) => {
        if (err) {
            return next(err);
        }
        // no document yet exists
        if (favorites == null) {
            Favorites.create( { 'user': req.user._id, 'dishes': [req.params.dishId] } )
            .then((favouriteDishes) => {
                Favorites.findById(favouriteDishes._id)
                .populate('user')
                .populate('dishes')
                .then((favorite) => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.json(favorite);
                })
            }, (err) => next(err))
            .catch((err) => next(err));
        }
        //some favourite dishes exist against this user already, let's update those
        else {
            // validate whether the favorite dish sent by the user is already added to favorites or not
            var newFavorites = [];
            Favorites.findOne(favorites._id)
            .then((favorites) => {
                if (favorites.dishes.indexOf(req.params.dishId) !== -1) {
                    console.log("Dish Already Added in Database");
                }
                else {
                    newFavorites.push(req.params.dishId);
                }

                // now let's send the new dish to the DB
                Favorites.findByIdAndUpdate(favorites._id, {
                    $push: {
                        'dishes': newFavorites
                    }
                },
                { upsert: true, new: true })
                .populate('user')
                .populate('dishes')
                .then((favouriteDishes) => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.json(favouriteDishes);
                }, (err) => next(err))
                .catch((err) => next(err));
            });
        }
    });
})
.put(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end('PUT operation not supported on /favorites/dishId');
})
.delete(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    Favorites.update({'user': req.user._id}, 
                    { $pullAll: { 'dishes': [req.params.dishId] }})
    .then((resp) => {
        Favorites.findOne({'user': req.user._id}, (err, favorites) => {
            if (favorites.dishes.length === 0) {
                Favorites.remove({_id: favorites._id})
                .then((resp) => {
                    console.log("Empty Favorites Entry Removed From Database");
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.json(resp);
                }, (err) => next(err))
                .catch((err) => next(err));
            }
            else {
                Favorites.findById(favorites._id)
                .populate('user')
                .populate('dishes')
                .then((favorite) => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.json(favorite);
                }, (err) => next(err))
                .catch((err) => next(err));
            }
        });
    }, (err) => next(err))
    .catch((err) => next(err));
})

module.exports = favoriteRouter;