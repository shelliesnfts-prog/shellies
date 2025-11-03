function Score() {
  var view = View.getInstance();

  var mainWrapper;
  var scoreWrapper;
  var coinScoreWrapper;
  var lifeCountWrapper;
  var levelWrapper;
  var controlsWrapper;

  this.coinScore;
  this.totalScore;
  this.lifeCount;

  var that = this;

  this.init = function() {
    that.coinScore = 0;
    that.totalScore = 0;
    that.lifeCount = 1; // Start with 1 life

    mainWrapper = view.getMainWrapper();

    scoreWrapper = view.create('div');
    coinScoreWrapper = view.create('div');
    lifeCountWrapper = view.create('div');
    levelWrapper = view.create('div');
    controlsWrapper = view.create('div');

    view.addClass(scoreWrapper, 'score-wrapper');
    view.addClass(coinScoreWrapper, 'coin-score');
    view.addClass(lifeCountWrapper, 'life-count');
    view.addClass(levelWrapper, 'level-num');
    view.addClass(controlsWrapper, 'controls-display');

    view.append(scoreWrapper, levelWrapper);
    view.append(scoreWrapper, lifeCountWrapper);
    view.append(scoreWrapper, coinScoreWrapper);
    view.append(scoreWrapper, controlsWrapper);
    view.append(mainWrapper, scoreWrapper);

    // Add controls content
    view.setHTML(controlsWrapper, 'ARROWS: Move | SPACE: Jump | SHIFT: Run');

    that.updateCoinScore();
    that.updateLifeCount();
    that.updateLevelNum(1);
  };

  this.updateCoinScore = function() {
    if (that.coinScore == 100) {
      that.coinScore = 0;
      that.lifeCount++;
      that.updateLifeCount();
    }

    view.setHTML(coinScoreWrapper, 'Coins: ' + that.coinScore);
  };


  this.updateLifeCount = function() {
    view.setHTML(lifeCountWrapper, 'Lives: ' + that.lifeCount);
  };

  this.updateLevelNum = function(level) {
    view.setHTML(levelWrapper, 'Level: ' + level);
  };

  this.loseLife = function() {
    that.lifeCount--;
    that.updateLifeCount();
    return that.lifeCount; // Return remaining lives
  };

  this.hasLivesRemaining = function() {
    return that.lifeCount > 0;
  };

  this.getCoinScore = function() {
    return that.coinScore;
  };

  this.setCoinScore = function(score) {
    that.coinScore = score;
    that.updateCoinScore();
  };

  this.getLifeCount = function() {
    return that.lifeCount;
  };

  this.setLifeCount = function(lives) {
    that.lifeCount = lives;
    that.updateLifeCount();
  };

  this.displayScore = function() {
    view.style(scoreWrapper, { display: 'block', background: "rgb(147,100,221)"  });
  };

  this.hideScore = function(preserveCoins) {
    view.style(scoreWrapper, { display: 'none' });

    if (!preserveCoins) {
      // Only reset coins and total score on respawn, NOT lives
      // Lives should only reset when starting a completely new game
      that.coinScore = 0;
      that.totalScore = 0;
      that.updateCoinScore();
      // Don't reset lives here - lives should persist after death until game over
    }
  };

  this.gameOverView = function() {
    view.style(scoreWrapper, { background: 'black' });
  };

  this.resetForNewGame = function() {
    // Reset everything including lives for a brand new game
    that.coinScore = 0;
    that.totalScore = 0;
    that.lifeCount = 1; // Reset to 1 life for new game
    that.updateCoinScore();
    that.updateLifeCount();
  };
}
