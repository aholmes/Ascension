Ascension = function() {
    this.players = [];
    this.tableau = new Tableau();

    this.players.push(new Player());

    this.tableau.drawPlayerHand(this.players[0]);
};

Tableau = function() {
    // only one tableau, so make a singleton. The canvas element needs to be accessible from a lot of places.
    if (typeof Tableau.instance === 'undefined') {
        this.canvas    = document.getElementById('gameCanvas');
        this.canvasCtx = this.canvas.getContext('2d');

        Tableau.instance = this;
    }

    return Tableau.instance;
};

Tableau.AREAS = {
    CENTERBOARD : 1,
    CENTERDECK  : 2,
    AVAILABLE   : 3, // mystic, heavy infantry, and cultist
    BANISHPILE  : 4,
    PLAYERHAND  : 5 // kind of an area. maybe want to rethink this.
};

// not sure i like this. it gets the ball rolling on draw card positions though.
Tableau.POSITIONS = {
    PLAYERHAND : function(index) {
        // x: width of the cards, in position at index. / 2 so there is some overlap between cards
        // y: put the bottom border of the card at the bottom of the canvas. 303 is the height of the cards
        return {
            x: (250 * index) / 2,
            y: (800 - 303)
        };
    }
};

Tableau.prototype.drawPlayerHand = function(player) {
    var index, card, imagesLoaded = 0, self = this;

    for(index in player.deck.hand) {
        if (!player.deck.hand.hasOwnProperty(index)) continue;
        card = player.deck.hand[index];

        card.getImage(function() {
            var loadedIndex, loadedCard;
            imagesLoaded++;

            // don't draw anything until all the images have loaded so we an get a nice overlaying display
            if (imagesLoaded === player.deck.hand.length) {
                // draw from card index 0 to 4
                for(loadedIndex in player.deck.hand) {
                    if (!player.deck.hand.hasOwnProperty(loadedIndex)) continue;
                    loadedCard = player.deck.hand[loadedIndex];

                    // this is not final, but will at least add the new position for a drawing of this card
                    loadedCard.imageCanvas.push({
                        x : Tableau.POSITIONS.PLAYERHAND(loadedIndex).x,
                        y : Tableau.POSITIONS.PLAYERHAND(loadedIndex).y
                    });

                    self.canvasCtx.drawImage(loadedCard.image, Tableau.POSITIONS.PLAYERHAND(loadedIndex).x, Tableau.POSITIONS.PLAYERHAND(loadedIndex).y);
                }
            }
        });
    }
};

Card = function(name, type, cardClass, endGameReward, actionCost, imagePath) {
    // hand, playable, or monster
    this.type          = name;
    // void, enlightened, lifebound, or mechana
    this.class         = cardClass;
    // points worth in deck at end of game
    this.endGameReward = endGameReward;
    // play or monster defect cost
    this.actionCost    = actionCost;
    this.imagePath     = '/img/cards/' + imagePath + '.png';
    this.image         = undefined;
    this.imageCanvas   = []; // an array of x/y positions for each drawn instance of this card
};

Card.TYPES = {
    HAND     : 0, // starting hand cards
    PLAYABLE : 1, // all playable card, including "available" and (maybe) "hand" cards. not sure if hand and playable should be handled the same.
    MONSTER  : 2  // all monster cards that aren't playable and can't be in your hand
};

Card.CLASS = {
    VOID        : 0,
    ENLIGHTENED : 1,
    LIFEBOUND   : 2,
    MECHANA     : 3,
    MONSTER     : 4,
    NONE        : 5 // militia, apprentice, mystic, and heavy infantry, perhaps others? not sure yet
};

Card.prototype.registerEvent = function(closure) {
    if (typeof closure !== 'function')
        throw 'Event registration argument must be a closure.';

    closure.call(this);

    return this;
};

Card.prototype.getImage = function(callback) {
    var image = new Image(), self = this;
    image.onload = function() {
        // FIXME need to look into this. it appears there is a reference to this image that is making it mutable in other contexts.
        /*
         <img src="/img/cards/militia.png">​   250 497 game.js:205
         <img src="/img/cards/apprentice.png">​500 497 game.js:205
         <img src="/img/cards/militia.png">​   250 497 game.js:205
         <img src="/img/cards/apprentice.png">​500 497 game.js:205
         <img src="/img/cards/apprentice.png">​500 497 game.js:205
         */
        // notice that the x positions are all the same for apprentice and militia?

        // assign the image here so other locations can do !image to detect if the image is loaded yet
        self.image = image;
        callback.call(this);
    };

    image.src = this.imagePath;

    return image;
};

// DEFINE ALL CARD TYPES
Cards = {
    // some code will be added later to do "if (type == playable) { ...; card.onPlay(); }
    militia : new Card('Militia', Card.TYPES.PLAYABLE, Card.CLASS.NONE, 0, 0, 'militia').registerEvent(function() {
        this.onPlay = function(player) {
            new Action(player, 'giveTempPower', 1).perform();
        };
    }),

    apprentice : new Card('Apprentice', Card.TYPES.PLAYABLE, Card.CLASS.NONE, 0, 0, 'apprentice').registerEvent(function() {
        this.onPlay = function(player) {
            new Action(player, 'giveTempRune', 1).perform();
        }
    }),

    heavy_infantry : new Card('Heavy Infantry', Card.TYPES.PLAYABLE, Card.CLASS.NONE, 1, 2, 'heavy-infantry').registerEvent(function() {
        this.onPlay = function(player) {
            new Action(player, 'giveTempPower', 2).perform();
        }
    }),

    mystic : new Card('Mystic', Card.TYPES.PLAYABLE, Card.CLASS.NONE, 1, 3, 'mystic').registerEvent(function() {
        this.onPlay = function(player) {
            new Action(player, 'giveTempRune', 2).perform();
        }
    })
};
// END CARD DEFINITIONS

Action = function(player, action) {
    this.player    = player;
    this.action    = action;
    this.arguments = Array.prototype.slice.call(arguments, 2);
};

Action.prototype.perform = function() {
    if (typeof this.customAction === 'function')
        this.customAction.apply(this.player, this.arguments);
    else
        this.player[this.action].apply(this.player, this.arguments);
};

PlayerDeck = function() {
    var i = 0;
    this.deck  = []; // cards in the deck
    this.hand  = []; // cards drawn
    this.trash = []; // cards discarded

    // initialize with 10 cards - 2 militias, and 8 apprentices
    for (i = 0; i < 2; i++) {
        this.deck.push(Cards.militia);
    }

    for (i = 0; i < 8; i++) {
        this.deck.push(Cards.apprentice);
    }

    this.deck.shuffle();
    // draw the initial 5 cards
    this.draw(5);
};

PlayerDeck.prototype.draw = function(numberOfCards) {
    // save us some cycles and return if there are no more cards to draw, and the discard pile is empty
    if (!this.deck.length && !this.trash.length) return;

    if (this.deck.length < numberOfCards) {
        numberOfCards = numberOfCards - this.deck.length;

        // draw the remaining cards, then reshuffle, then draw the remaining cards
        this.hand = this.hand.concat(this.deck.splice(0, this.deck.length));

        this.reshuffle();
    }

    // slice from the top of the deck (index 0), and push into the hand
    this.hand = this.hand.concat(this.deck.splice(0, numberOfCards));
};

PlayerDeck.prototype.discard = function(cards) {
    var card, index, i;

    // if no cards are supplied, remove all cards from hand and put in discard pile
    if (cards.length === 0) {

        // this doesn't draw correctly because of a bug with referencing the same image positions for each image
        for (index in this.hand) {
            if (!this.hand.hasOwnProperty(index)) continue;
            card = this.hand[index];

            if (!card.image) continue;

            // this is not permanent, but will undraw all drawn positions of this card. this coincides with the imageCanvas lines from drawing the images
            for(i = 0; i < card.imageCanvas.length; i++) {
                new Tableau().canvasCtx.undrawImage(card.image, card.imageCanvas[i].x, card.imageCanvas[i].y);
            }
        }

        this.trash = this.trash.concat(this.hand.splice(0));
    } else {
        for (card in cards) {
            if (!cards[card].hasOwnProperty(card)) continue;

            // FIXME need to think about how to actually reference the cards for these methods
            this.trash.push(this.hand[card]);
            delete this.hand[card];
        }
    }
};

PlayerDeck.prototype.shuffle = function() {
    this.deck.shuffle();
};

PlayerDeck.prototype.reshuffle = function() {
    // remove all cards from discard pile and put them into the draw deck, then shuffle
    this.deck = this.deck.concat(this.trash.splice(0));
    this.shuffle();
};

Player = function() {
    this.playerNumber = 0; // player number for sequencing players
    this.deck         = new PlayerDeck(); // all cards the player currently owns
    this.points       = 0; // point tokens earned
    this.currentRunes = 0; // temporary rune count for purchasing
    this.currentPower = 0; // temporary power count for defeating monsters
};

Player.prototype.draw = function(numberOfCards) {
    // pull numberOfCards from the deck, add them to the players hand
    console.log('Player #' + this.playerNumber + ' is drawing ' + numberOfCards + ' cards.');
    this.deck.draw(numberOfCards);
    new Tableau().drawPlayerHand(this);
};

/**
 *
 * @param from Either Tableau.AREAS.PLAYERHAND or Tableau.AREAS.BANISHPILE
 * @param numberToBanish
 */
Player.prototype.banish = function(from, numberToBanish) {
    console.log('Player #' + this.playerNumber + ' is banishing ' + numberToBanish + ' cards from ' + from);
};

Player.prototype.givePoints = function(numberOfPoints) {
    console.log('Adding ' + numberOfPoints + ' to player #' + this.playerNumber + '\'s score.');
    this.points += numberOfPoints;
};

Player.prototype.giveTempPower = function(numberOfPower) {
    console.log('Adding ' + numberOfPower + ' to player #' + this.playerNumber + '\'s temp power.');
    this.currentPower += numberOfPower;
};

Player.prototype.giveTempRune = function(numberOfRune) {
    console.log('Adding ' + numberOfRune + ' to player #' + this.playerNumber + '\'s temp runes.');
    this.currentRunes += numberOfRune;
};

Player.prototype.discard = function(numberToDiscard) {
    // make the player choose the number of cards from his hand to discard
    console.log('Player #' + this.playerNumber + ' is discarding ' + numberToDiscard + ' cards.');
};

// I don't remember what this was for, but it's in my notes, so store it here for later just in case
Player.prototype.acquireBonus = function() {};

// need to figure out where to handle the monster event
Player.prototype.monsterEvent = function() {};

Player.prototype.endTurn = function() {
    console.log('Player #' + this.playerNumber + ' is ending their turn.');
    // toss hand
    this.deck.discard([]);
    // redraw cards
    this.deck.draw(5);

    new Tableau().drawPlayerHand(this);
};

Array.prototype.shuffle = function() {
    var len = this.length;
    var i = len;
    while (i--) {
        var p = parseInt(Math.random()*len);
        var t = this[i];
        this[i] = this[p];
        this[p] = t;
    }
};

// this really only fills the area in with a rectangle, and doesn't care about anything behind it that would need re-rendering.
CanvasRenderingContext2D.prototype.undrawImage = function(image, x, y) {
    this.fillStyle = '#FFFFFF';
    this.fillRect(x, y, image.width, image.height);
};
