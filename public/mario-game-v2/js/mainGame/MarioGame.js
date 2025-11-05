// Main Class of Mario Game

function MarioGame() {
  var gameUI = GameUI.getInstance();

  var maxWidth; //width of the game world
  var height;
  var viewPort; //width of canvas, viewPort that can be seen
  var tileSize;
  var map;
  var originalMaps;

  var translatedDist; //distance translated(side scrolled) as mario moves to the right
  var centerPos; //center position of the viewPort, viewable screen
  var marioInGround;

  //instances
  var mario;
  var element;
  var gameSound;
  var score;
  var coinCount = 0; // Track total coins collected across all levels
  var currentLevelCoins = 0; // Track coins collected in current level only

  var keys = [];
  var goombas;
  var powerUps;

  var currentLevel;

  var animationID;
  var timeOutId;
  var gameOverState = false;
  var restartButton;
  var leaderboardButton;
  var currentBestScore = 0;

  var tickCounter = 0; //for animating mario
  var maxTick = 25; //max number for ticks to show mario sprite
  var instructionTick = 0; //showing instructions counter
  var that = this;

  this.init = function(levelMaps, level, isRespawn) {
    height = 480;
    maxWidth = 0;
    viewPort = 1280;
    tileSize = 32;
    translatedDist = 0;
    goombas = [];
    powerUps = [];
    gameOverState = false;

    gameUI.setWidth(viewPort);
    gameUI.setHeight(height);
    gameUI.show();

    currentLevel = level;
    originalMaps = levelMaps;
    map = JSON.parse(levelMaps[currentLevel]);

    if (!score) {
      //so that when level changes, it uses the same instance
      score = new Score();
      score.init();
    }
    score.displayScore();
    score.updateLevelNum(currentLevel);
    
    // Handle different types of game initialization
    if (level === 1 && !isRespawn) {
      // Brand new game - reset everything including lives and all coins
      coinCount = 0;
      currentLevelCoins = 0;
      if (score) {
        score.resetForNewGame();
      }
    } else if (isRespawn) {
      // Respawn at same level - keep total coins from previous levels, reset only current level coins
      currentLevelCoins = 0;
      if (score) {
        score.setCoinScore(coinCount); // Reset display to total coins (excluding current level)
        // Lives should already be decremented by loseLife() - don't touch them
      }
    } else {
      // Level progression - keep all coins accumulated, start fresh for new level
      currentLevelCoins = 0;
      if (score) {
        score.setCoinScore(coinCount); // Keep showing total coins accumulated
      }
    }
    
    // Notify parent window that game started
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'GAME_STARTED' }, '*');
    }
    
    // Listen for messages from parent window
    that.setupMessageListener();

    if (!mario) {
      //so that when level changes, it uses the same instance
      mario = new Mario();
      mario.init();
    } else {
      mario.x = 10;
      mario.frame = 0;
    }
    element = new Element();
    gameSound = new GameSound();
    gameSound.init();

    that.calculateMaxWidth();
    that.bindKeyPress();
    that.clearKeyStates(); // Clear any stuck key states
    that.startGame();
  };

  that.calculateMaxWidth = function() {
    //calculates the max width of the game according to map size
    for (var row = 0; row < map.length; row++) {
      for (var column = 0; column < map[row].length; column++) {
        if (maxWidth < map[row].length * 32) {
          maxWidth = map[column].length * 32;
        }
      }
    }
  };

  that.clearKeyStates = function() {
    // Clear all key states to prevent stuck keys
    keys = [];
    for (var i = 0; i < 256; i++) {
      keys[i] = false;
    }
  };

  that.bindKeyPress = function() {
    var canvas = gameUI.getCanvas(); //for use with touch events

    //key binding
    document.body.addEventListener('keydown', function(e) {
      keys[e.keyCode] = true;
    });

    document.body.addEventListener('keyup', function(e) {
      keys[e.keyCode] = false;
    });

    //key binding for touch events
    canvas.addEventListener('touchstart', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = true; //left arrow
        }
        if (touches[i].pageX > 200 && touches[i].pageX < 400) {
          keys[39] = true; //right arrow
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          //in touch events, this area acts as sprint key only
          keys[16] = true; //shift key
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = true; //space
        }
      }
    });

    canvas.addEventListener('touchend', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = false;
        }
        if (touches[i].pageX > 200 && touches[i].pageX <= 640) {
          keys[39] = false;
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          keys[16] = false;
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = false;
        }
      }
    });

    canvas.addEventListener('touchmove', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = true;
          keys[39] = false;
        }
        if (touches[i].pageX > 200 && touches[i].pageX < 400) {
          keys[39] = true;
          keys[37] = false;
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          keys[16] = true;
          keys[32] = false;
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = true;
          keys[16] = false;
        }
      }
    });
  };

  //Main Game Loop
  this.startGame = function() {
    animationID = window.requestAnimationFrame(that.startGame);

    gameUI.clear(0, 0, maxWidth, height);

    if (instructionTick < 1000) {
      //that.showInstructions(); //showing control instructions
      instructionTick++;
    }

    that.renderMap();

    for (var i = 0; i < powerUps.length; i++) {
      powerUps[i].draw();
      powerUps[i].update();
    }


    for (var i = 0; i < goombas.length; i++) {
      goombas[i].draw();
      goombas[i].update();
    }

    that.checkPowerUpMarioCollision();
    that.checkEnemyMarioCollision();

    mario.draw();
    that.updateMario();
    that.wallCollision();
    marioInGround = mario.grounded; //for use with flag sliding
  };

  this.showInstructions = function() {
    gameUI.writeText('Controls: Arrow keys for direction, shift to run', 30, 30);
    gameUI.writeText('Tip: Jumping while running makes you jump higher', 30, 60);
  };

  this.renderMap = function() {
    //setting false each time the map renders so that elements fall off a platform and not hover around
    mario.grounded = false;

    for (var i = 0; i < powerUps.length; i++) {
      powerUps[i].grounded = false;
    }
    for (var i = 0; i < goombas.length; i++) {
      goombas[i].grounded = false;
    }

    for (var row = 0; row < map.length; row++) {
      for (var column = 0; column < map[row].length; column++) {
        switch (map[row][column]) {
          case 1: //platform
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.platform();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            break;

          case 2: //coinBox
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.coinBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            break;

          case 3: //powerUp Box
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.powerUpBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            break;

          case 4: //uselessBox
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.uselessBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            break;

          case 5: //flagPole
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.flagPole();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            break;

          case 6: //flag
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.flag();
            element.draw();
            break;

          case 7: //pipeLeft
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeLeft();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            break;

          case 8: //pipeRight
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeRight();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            break;

          case 9: //pipeTopLeft
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeTopLeft();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            break;

          case 10: //pipeTopRight
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeTopRight();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            break;

          case 20: //goomba
            var enemy = new Enemy();
            enemy.x = column * tileSize;
            enemy.y = row * tileSize;
            enemy.goomba();
            enemy.draw();

            goombas.push(enemy);
            map[row][column] = 0;
        }
      }
    }
  };

  this.collisionCheck = function(objA, objB) {
    // get the vectors to check against
    var vX = objA.x + objA.width / 2 - (objB.x + objB.width / 2);
    var vY = objA.y + objA.height / 2 - (objB.y + objB.height / 2);

    // add the half widths and half heights of the objects
    var hWidths = objA.width / 2 + objB.width / 2;
    var hHeights = objA.height / 2 + objB.height / 2;
    var collisionDirection = null;

    // if the x and y vector are less than the half width or half height, then we must be inside the object, causing a collision
    if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
      // figures out on which side we are colliding (top, bottom, left, or right)
      var offsetX = hWidths - Math.abs(vX);
      var offsetY = hHeights - Math.abs(vY);

      if (offsetX >= offsetY) {
        if (vY > 0 && vY < 37) {
          collisionDirection = 't';
          if (objB.type != 5) {
            //if flagpole then pass through it
            objA.y += offsetY;
          }
        } else if (vY < 0) {
          collisionDirection = 'b';
          if (objB.type != 5) {
            //if flagpole then pass through it
            objA.y -= offsetY;
          }
        }
      } else {
        if (vX > 0) {
          collisionDirection = 'l';
          objA.x += offsetX;
        } else {
          collisionDirection = 'r';
          objA.x -= offsetX;
        }
      }
    }
    return collisionDirection;
  };

  this.checkElementMarioCollision = function(element, row, column) {
    var collisionDirection = that.collisionCheck(mario, element);

    if (collisionDirection == 'l' || collisionDirection == 'r') {
      mario.velX = 0;
      mario.jumping = false;

      if (element.type == 5) {
        //flag pole
        that.levelFinish(collisionDirection);
      }
    } else if (collisionDirection == 'b') {
      if (element.type != 5) {
        //only if not flag pole
        mario.grounded = true;
        mario.jumping = false;
      }
    } else if (collisionDirection == 't') {
      if (element.type != 5) {
        mario.velY *= -1;
      }

      if (element.type == 3) {
        //PowerUp Box
        var powerUp = new PowerUp();

        //gives mushroom if mario is small, otherwise gives flower
        if (mario.type == 'small') {
          powerUp.mushroom(element.x, element.y);
          powerUps.push(powerUp);
        } else {
          powerUp.flower(element.x, element.y);
          powerUps.push(powerUp);
        }

        map[row][column] = 4; //sets to useless box after powerUp appears

        //sound when mushroom appears
        gameSound.play('powerUpAppear');
      }

      if (element.type == 11) {
        //Flower Box
        var powerUp = new PowerUp();
        powerUp.flower(element.x, element.y);
        powerUps.push(powerUp);

        map[row][column] = 4; //sets to useless box after powerUp appears

        //sound when flower appears
        gameSound.play('powerUpAppear');
      }

      if (element.type == 2) {
        //Coin Box
        currentLevelCoins++; // Track current level coins
        coinCount++; // Track total coins across all levels
        score.coinScore++;
        score.totalScore += 100;

        score.updateCoinScore();
        map[row][column] = 4; //sets to useless box after coin appears

        //sound when coin block is hit
        gameSound.play('coin');
      }
    }
  };

  this.checkElementPowerUpCollision = function(element) {
    for (var i = 0; i < powerUps.length; i++) {
      var collisionDirection = that.collisionCheck(powerUps[i], element);

      if (collisionDirection == 'l' || collisionDirection == 'r') {
        powerUps[i].velX *= -1; //change direction if collision with any element from the sidr
      } else if (collisionDirection == 'b') {
        powerUps[i].grounded = true;
      }
    }
  };

  this.checkElementEnemyCollision = function(element) {
    for (var i = 0; i < goombas.length; i++) {
      var collisionDirection = that.collisionCheck(goombas[i], element);

      if (collisionDirection == 'l' || collisionDirection == 'r') {
        goombas[i].velX *= -1;
      } else if (collisionDirection == 'b') {
        goombas[i].grounded = true;
      }
    }
  };


  this.checkPowerUpMarioCollision = function() {
    for (var i = 0; i < powerUps.length; i++) {
      var collWithMario = that.collisionCheck(powerUps[i], mario);
      if (collWithMario) {
        if (powerUps[i].type == 30 && mario.type == 'small') {
          //mushroom
          mario.type = 'big';
        } else if (powerUps[i].type == 31) {
          //flower
          mario.type = 'fire';
        }
        powerUps.splice(i, 1);

        score.totalScore += 1000;

        //sound when mushroom appears
        gameSound.play('powerUp');
      }
    }
  };

  this.checkEnemyMarioCollision = function() {
    for (var i = 0; i < goombas.length; i++) {
      if (!mario.invulnerable && goombas[i].state != 'dead') {
        //if mario is invulnerable or goombas state is dead, collision doesnt occur
        var collWithMario = that.collisionCheck(goombas[i], mario);

        if (collWithMario == 't') {
          //kill goombas if collision is from top
          goombas[i].state = 'dead';

          mario.velY = -mario.speed;

          score.totalScore += 1000;
          score.updateTotalScore();

          //sound when enemy dies
          gameSound.play('killEnemy');
        } else if (collWithMario == 'r' || collWithMario == 'l' || collWithMario == 'b') {
          goombas[i].velX *= -1;

          if (mario.type == 'big') {
            mario.type = 'small';
            mario.invulnerable = true;
            collWithMario = undefined;

            //sound when mario powerDowns
            gameSound.play('powerDown');

            setTimeout(function() {
              mario.invulnerable = false;
            }, 1000);
          } else if (mario.type == 'fire') {
            mario.type = 'big';
            mario.invulnerable = true;

            collWithMario = undefined;

            //sound when mario powerDowns
            gameSound.play('powerDown');

            setTimeout(function() {
              mario.invulnerable = false;
            }, 1000);
          } else if (mario.type == 'small') {
            //kill mario if collision occurs when he is small (single life mode)
            that.pauseGame();

            mario.frame = 13;
            collWithMario = undefined;

            //sound when mario dies
            gameSound.play('marioDie');

            // Check if we should show game over or just lose a life
            var shouldGameOver = score.loseLife();
            if (shouldGameOver <= 0) {
              timeOutId = setTimeout(function() {
                that.gameOver();
              }, 3000);
            } else {
              // Respawn at same level after delay
              timeOutId = setTimeout(function() {
                // Remove current level coins from total (player loses coins from level they died in)
                coinCount -= currentLevelCoins;
                var marioMaker = MarioMaker.getInstance();
                marioMaker.respawnAtCurrentLevel();
              }, 3000);
            }
            break;
          }
        }
      }
    }
  };


  this.wallCollision = function() {
    //for walls (vieport walls)
    if (mario.x >= maxWidth - mario.width) {
      mario.x = maxWidth - mario.width;
    } else if (mario.x <= translatedDist) {
      mario.x = translatedDist + 1;
    }

    //for ground (viewport ground)
    if (mario.y >= height) {
      that.pauseGame();

      //sound when mario dies
      gameSound.play('marioDie');

      // Check if we should show game over or just lose a life
      var shouldGameOver = score.loseLife();
      if (shouldGameOver <= 0) {
        timeOutId = setTimeout(function() {
          that.gameOver();
        }, 3000);
      } else {
        // Respawn at same level after delay
        timeOutId = setTimeout(function() {
          // Remove current level coins from total (player loses coins from level they died in)
          coinCount -= currentLevelCoins;
          var marioMaker = MarioMaker.getInstance();
          marioMaker.respawnAtCurrentLevel();
        }, 3000);
      }
    }
  };

  //controlling mario with key events
  this.updateMario = function() {
    var friction = 0.9;
    var gravity = 0.2;

    mario.checkMarioType();

    if (keys[38] || keys[32]) {
      //up arrow
      if (!mario.jumping && mario.grounded) {
        mario.jumping = true;
        mario.grounded = false;
        mario.velY = -(mario.speed / 2 + 5.5);

        // mario sprite position
        if (mario.frame == 0 || mario.frame == 1) {
          mario.frame = 3; //right jump
        } else if (mario.frame == 8 || mario.frame == 9) {
          mario.frame = 2; //left jump
        }

        //sound when mario jumps
        gameSound.play('jump');
      }
    }

    if (keys[39]) {
      //right arrow
      that.checkMarioPos(); //if mario goes to the center of the screen, sidescroll the map

      if (mario.velX < mario.speed) {
        mario.velX++;
      }

      //mario sprite position
      if (!mario.jumping) {
        tickCounter += 1;

        if (tickCounter > maxTick / mario.speed) {
          tickCounter = 0;

          if (mario.frame != 1) {
            mario.frame = 1;
          } else {
            mario.frame = 0;
          }
        }
      }
    }

    if (keys[37]) {
      //left arrow
      if (mario.velX > -mario.speed) {
        mario.velX--;
      }

      //mario sprite position
      if (!mario.jumping) {
        tickCounter += 1;

        if (tickCounter > maxTick / mario.speed) {
          tickCounter = 0;

          if (mario.frame != 9) {
            mario.frame = 9;
          } else {
            mario.frame = 8;
          }
        }
      }
    }

    if (keys[16]) {
      //shift key
      mario.speed = 4.5;
    } else {
      mario.speed = 3;
    }


    //velocity 0 sprite position
    if (mario.velX > 0 && mario.velX < 1 && !mario.jumping) {
      mario.frame = 0;
    } else if (mario.velX > -1 && mario.velX < 0 && !mario.jumping) {
      mario.frame = 8;
    }

    if (mario.grounded) {
      mario.velY = 0;

      //grounded sprite position
      if (mario.frame == 3) {
        mario.frame = 0; //looking right
      } else if (mario.frame == 2) {
        mario.frame = 8; //looking left
      }
    }

    //change mario position
    mario.velX *= friction;
    mario.velY += gravity;

    mario.x += mario.velX;
    mario.y += mario.velY;
  };

  this.checkMarioPos = function() {
    centerPos = translatedDist + viewPort / 2;

    //side scrolling as mario reaches center of the viewPort
    if (mario.x > centerPos && centerPos + viewPort / 2 < maxWidth) {
      gameUI.scrollWindow(-mario.speed, 0);
      translatedDist += mario.speed;
    }
  };

  this.levelFinish = function(collisionDirection) {
    //game finishes when mario slides the flagPole and collides with the ground
    if (collisionDirection == 'r') {
      mario.x += 10;
      mario.velY = 2;
      mario.frame = 11;
    } else if (collisionDirection == 'l') {
      mario.x -= 32;
      mario.velY = 2;
      mario.frame = 10;
    }

    if (marioInGround) {
      mario.x += 20;
      mario.frame = 10;
      tickCounter += 1;
      if (tickCounter > maxTick) {
        that.pauseGame();

        mario.x += 10;
        tickCounter = 0;
        mario.frame = 12;

        //sound when stage clears
        gameSound.play('stageClear');

        timeOutId = setTimeout(function() {
          // Send level completion message to parent window before advancing
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ 
              type: 'LEVEL_COMPLETED', 
              coins: coinCount, // Send total coins accumulated
              level: currentLevel
            }, '*');
          }
          
          // Current level coins are already added to coinCount during collection
          // No need to add them again here
          
          currentLevel++;
          if (originalMaps[currentLevel]) {
            // Update MarioMaker's level tracking
            var marioMaker = MarioMaker.getInstance();
            marioMaker.updateCurrentLevel(currentLevel);
            
            that.init(originalMaps, currentLevel, false); // Not a respawn, level progression
            score.updateLevelNum(currentLevel);
          } else {
            that.gameOver();
          }
        }, 5000);
      }
    }
  };

  this.pauseGame = function() {
    window.cancelAnimationFrame(animationID);
  };

  this.setupMessageListener = function() {
    window.addEventListener('message', function(event) {
      if (event.data.type === 'BEST_SCORE') {
        currentBestScore = event.data.bestScore || 0;
      }
    });
  };

  this.gameOver = function() {
    gameOverState = true;
    
    // Send coin count to parent window for persistence FIRST
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ 
        type: 'GAME_OVER', 
        coins: coinCount 
      }, '*');
      
      // Wait a bit for the parent to update and send back the best score
      setTimeout(function() {
        that.showGameOverScreen();
      }, 100);
    } else {
      // No parent window, show immediately
      that.showGameOverScreen();
    }
  };
  
  this.showGameOverScreen = function() {
    score.gameOverView();
    gameUI.makeBox(0, 0, maxWidth, height);
    gameUI.writeText('Game Over', centerPos - 80, height - 300);
    gameUI.writeText('Thanks For Playing', centerPos - 122, height / 2);
    
    // Use the max of coin count and current best score to ensure we show the right value
    var displayScore = Math.max(coinCount, currentBestScore);
    
    // Create restart and leaderboard buttons
    that.createGameOverButtons();
  };
  
  this.createGameOverButtons = function() {
    var view = View.getInstance();
    var mainWrapper = view.getMainWrapper();
    
    // Create restart button
    restartButton = view.create('button');
    view.addClass(restartButton, 'restart-btn');
    view.setHTML(restartButton, 'Restart Game');
    
    restartButton.onclick = function() {
      // Notify parent window that user wants to restart (payment check)
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'GAME_RESTART_ATTEMPT' }, '*');
      } else {
        // If not in iframe, restart game directly
        that.restartGame();
      }
    };
    
    // Position restart button on the left
    view.style(restartButton, {
      position: 'absolute',
      left: '42%',
      top: '60%',
      transform: 'translate(-50%, -50%)',
      zIndex: '1000'
    });
    
    view.append(mainWrapper, restartButton);
    
    // Create leaderboard button
    leaderboardButton = view.create('button');
    view.addClass(leaderboardButton, 'leaderboard-btn');
    view.setHTML(leaderboardButton, 'Check Leaderboard');
    
    leaderboardButton.onclick = function() {
      that.navigateToLeaderboard();
    };
    
    // Position leaderboard button on the right
    view.style(leaderboardButton, {
      position: 'absolute',
      left: '58%',
      top: '60%',
      transform: 'translate(-50%, -50%)',
      zIndex: '1000'
    });
    
    view.append(mainWrapper, leaderboardButton);
  };
  
  this.navigateToLeaderboard = function() {
    // Navigate to leaderboard page by communicating with parent window
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'NAVIGATE_TO_LEADERBOARD'
      }, '*');
    } else {
      // Fallback for direct access
      window.location.href = '/leaderboard';
    }
  };

  this.restartGame = function() {
    if (restartButton) {
      var view = View.getInstance();
      var mainWrapper = view.getMainWrapper();
      view.remove(mainWrapper, restartButton);
      restartButton = null;
    }
    
    if (leaderboardButton) {
      var view = View.getInstance();
      var mainWrapper = view.getMainWrapper();
      view.remove(mainWrapper, leaderboardButton);
      leaderboardButton = null;
    }
    
    gameOverState = false;
    
    // Notify MarioMaker to restart
    var marioMaker = MarioMaker.getInstance();
    marioMaker.restartCurrentGame();
  };

  this.resetGame = function() {
    that.clearInstances();
    that.init(originalMaps, currentLevel, true); // Reset game is like respawning
  };

  this.clearInstances = function() {
    mario = null;
    element = null;
    gameSound = null;

    goombas = [];
    powerUps = [];
    
    // Clean up buttons if they exist
    if (restartButton) {
      var view = View.getInstance();
      var mainWrapper = view.getMainWrapper();
      view.remove(mainWrapper, restartButton);
      restartButton = null;
    }
    
    if (leaderboardButton) {
      var view = View.getInstance();
      var mainWrapper = view.getMainWrapper();
      view.remove(mainWrapper, leaderboardButton);
      leaderboardButton = null;
    }
    
    gameOverState = false;
  };

  this.clearTimeOut = function() {
    clearTimeout(timeOutId);
  };

  this.removeGameScreen = function(preserveCoins) {
    gameUI.hide();

    if (score) {
      score.hideScore(preserveCoins);
    }
  };

  this.showGameScreen = function() {
    gameUI.show();
  };

  this.getScore = function() {
    return score;
  };
}
