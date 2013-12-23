// The Grid component allows an element to be located
//  on a grid of tiles
Crafty.c('Grid', {
  init: function(){
    this.attr({
      w: Game.map_grid.tile.width,
      h: Game.map_grid.tile.height
    })
  },
  
  // Locate this entity at the given position on the grid
  at: function (x, y) {
    if (x === undefined && y === undefined) {
      return {
        x: this.x / Game.map_grid.tile.width,
        y: this.y / Game.map_grid.tile.height
      }
      } else {
      this.attr({
        x: x * Game.map_grid.tile.width,
        y: y * Game.map_grid.tile.height
      });
      return this;
    }
  }
});

// An "Actor" is an entity that is drawn in 2D on canvas
//  via our logical coordinate grid
Crafty.c('Actor', {
  init: function(){
    this.requires('2D, Canvas, Grid');
  }
});

// This is the player-controlled character
Crafty.c('PlayerCharacter', {
  leftUp: true,
  rightUp: true,
  upUp: true,
  knockback: 0,
  laserPistol: -1,
  energyRifle: -1,
  plasmaCannon: -1,
  currentWeapon: "",
  hp: 3,
  maxHp: 3,
  o2: 5*120,
  maxO2: 5*120,
  checkpoint: {x:208, y:384},
  dead: -1,
  openedChests: [],
  jetpack: -1,
  
  init: function(){
    this.requires('Actor, Twoway, Collision, spr_player, SpriteAnimation, Persist')
      .multiway(2)
      .collision([0,10],[42,10],[42,62],[0,62])
      .attr({z:1000})
      //.animate("walk_right", [[44,582],[172,582],[300,582],[428,582]])
      //.animate("walk_right", [[0,544],[136,544],[272,544],[408,544]])
      //.animate("walk_right", [[0,4],[1,4],[2,4],[3,4]])
      .animate("walk_left", 1, 1, 3)
      .animate("walk_right", 1, 0, 3)
      .animate("walk_left_up", 1, 3, 3)
      .animate("walk_right_up", 1, 2, 3)
      //.crop(44, 46, 42, 52)
      .bind('EnterFrame', function(){
        if (this.dead == -1){
          // change to jumping sprite
          if (this._movement.y != 0){
            if ((this.__coord[1] == 0 && this.__coord[0] == 0) || this._movement.x > 0){
              this.stop().sprite(4, 0, 1, 1);
            }
            else if ((this.__coord[1] != 0 && this.__coord[0] == 0) || this._movement.x < 0){
              this.stop().sprite(4, 1, 1, 1);
            }
          }
          
          // gravity
          if (this._movement.y < 4){
            this._movement.y = Math.round((this._movement.y + 0.1) * 10) / 10;
          }
          
          // stop movement if no keys pressed
          if (this.leftUp && this.rightUp && this.knockback == 0){
            this._movement.x = 0;
          }
          
          // if the x movement was stopped by a collision and the key is still held down,
          // resume the x movement when it's no longer colliding
          if (!this.hit("Solid") && this.knockback == 0){
            if (!this.leftUp){
              this._movement.x = -2;
            }
            else if (!this.rightUp){
              this._movement.x = 2;
            }
          }
          
          // custom collision handling (probing)
          this.x += this._movement.x;
          if (this.hit("Solid") != false){
            this.x -= this._movement.x;
            this._movement.x = 0;
          }
          this.x -= this._movement.x;
          this.y += this._movement.y;
          if (this.hit("Solid") != false){
            while (this.hit("Solid") != false){
              this.y -= 0.1 * (this._movement.y / Math.abs(this._movement.y));
            }
            this.y -= 0.1 * (this._movement.y / Math.abs(this._movement.y));
            if ((this._movement.y == 0 || this._movement.y == 0.1) && this.__coord[0] == 176){
              if (this._movement.x < 0){
                this.sprite(0, 0, 1, 1);
                this.stop().animate("walk_left", 15, -1);
              }
              else if (this._movement.x > 0){
                this.sprite(0, 1, 1, 1);
                this.stop().animate("walk_right", 15, -1);
              }
              else{
                if (this.__coord[1] == 0){
                  this.sprite(0, 0, 1, 1);
                }
                else{
                  this.sprite(0, 1, 1, 1);
                }
              }
            }
            this._movement.y = 0;
          }
          this.y -= this._movement.y;
          this.y = Math.round((this._y + 0.1) * 10) / 10;
          
          // custom viewport scrolling (viewport.follow() drops fps below 1)
          Crafty.viewport.x = Crafty("PlayerCharacter")._x * -1 + (Game.width() / 2);
          var addend = Crafty("PlayerCharacter")._x - (Game.width() / 2);
          Crafty("GUI").each(function(){
            this.x = addend + this.offset;
          });
          
          // decrease the amount of time the player is unable to move due to being knocked back
          if (this.knockback > 0){
            this.knockback--;
          }
          
          // increase the player's oxygen if not standing in a draining area
          if (((Crafty._current != "Overworld" && !this.hit("DrainO2")) || (this.hit("FillO2") != false || this.hit("Spawner") != false || this.hit("Refill") != false)) && this.o2 < this.maxO2){
            this.incrementO2();
          }
          
          // decrease the player's oxygen if in the overworld
          if (Crafty._current == "Overworld" && (!this.hit("FillO2") && !this.hit("Spawner") && !this.hit("Refill"))){
            this.decrementO2();
          }
        }
        else{
          if (this.dead == 0){
            this.respawn();
          }
          this.dead--;
        }
      })
      .bind('KeyDown', function(e){
        // Z
        if (e.which == 90 && (this._movement.y == 0 || this.jetpack != -1)){
          this.y -= 4;
          if (!this.hit("Solid")){
            this._movement.y = -4;
          }
          this.y += 4;
        }
        if (this.knockback == 0){
          // left
          if (e.which == 37){
            this.leftUp = false;
            this.x -= 2;
            if (!this.hit("Solid")){
              this._movement.x = -2;
              if (this.upUp){
                this.stop().animate("walk_left", 15, -1);
              }
              else{
                this.stop().animate("walk_left_up", 15, -1);
              }
            }
            this.x += 2;
          }
          // right
          if (e.which == 39){
            this.rightUp = false;
            this.x += 2;
            if (!this.hit("Solid")){
              this._movement.x = 2;
              if (this.upUp){
                this.stop().animate("walk_right", 15, -1);
              }
              else{
                this.stop().animate("walk_right_up", 15, -1);
              }
            }
            this.x -= 2;
          }
        }
        // up
        /*if (e.which == 38){
          this.upUp = false;
          if (this._movement.x < 0){
            this.stop().animate("walk_left_up", 15, -1);
          }
          else if (this._movement.x > 0){
            this.stop().animate("walk_right_up", 15, -1);
          }
          else{
            if (this.__coord[1] == 0){
              this.sprite(0, 2, 1, 1);
            }
            else{
              this.sprite(0, 3, 1, 1);
            }
          }
        }*/
        // X
        if (e.which == 88){
          if (this.currentWeapon != ""){
            if (this.currentWeapon == "LaserPistol" || (this.currentWeapon == "EnergyRifle" && this.energyRifle > 0) || (this.currentWeapon == "PlasmaCannon" && this.plasmaCannon > 0)){
              var pc = this;
              var done = false;
              Crafty(this.currentWeapon + "Bullet").each(function(){
                if (!done){
                  if (this._x == -100 && this.y == -100){
                    this.attr({x:pc._x+22, y:pc._y+23}).fire();
                    Crafty.audio.play(pc.currentWeapon.toLowerCase());
                    if (pc.currentWeapon == "EnergyRifle"){
                      pc.energyRifle--;
                      Crafty("AmmoCount").text(pc.energyRifle);
                    }
                    else if (pc.currentWeapon == "PlasmaCannon"){
                      pc.plasmaCannon--;
                      Crafty("AmmoCount").text(pc.plasmaCannon);
                    }
                    done = true;
                  }
                }
              });
            }
          }
        }
        // Q
        /*if (e.which == 81){
          this.x -= 128;
        }
        // E
        if (e.which == 69){
          this.x += 128;
        }*/
        // C
        if (e.which == 67){
          /*var weapons = ["LaserPistol", "EnergyRifle", "PlasmaCannon"];
          this.currentWeapon = "LaserPistol";
          Crafty("WeaponIcon").changeWeapon("LaserPistol");
          Crafty("AmmoCount").text("&infin;");*/
          if ((this.currentWeapon == "LaserPistol" && this.energyRifle != -1)){
            this.currentWeapon = "EnergyRifle";
            Crafty("WeaponIcon").changeWeapon("EnergyRifle");
            Crafty("AmmoCount").text(this.energyRifle);
          }
          else if (this.currentWeapon == "EnergyRifle" && this.plasmaCannon != -1){
            this.currentWeapon = "PlasmaCannon";
            Crafty("WeaponIcon").changeWeapon("PlasmaCannon");
            Crafty("AmmoCount").text(this.plasmaCannon);
          }
          else if (this.currentWeapon == "PlasmaCannon" || (this.currentWeapon == "EnergyRifle" && this.plasmaCannon == -1)){
            this.currentWeapon = "LaserPistol";
            Crafty("WeaponIcon").changeWeapon("LaserPistol");
            Crafty("AmmoCount").text("&infin;");
          }
        }
      })
      .bind('KeyUp', function(e){
        // left
        if (e.which == 37){
          this.leftUp = true;
          if (this.rightUp){
            if (this.upUp){
              this.stop().sprite(0, 1, 1, 1);
            }
            else{
              this.stop().sprite(0, 3, 1, 1);
            }
          }
        }
        // right
        else if (e.which == 39){
          this.rightUp = true;
          if (this.leftUp){
            if (this.upUp){
              this.stop().sprite(0, 0, 1, 1);
            }
            else{
              this.stop().sprite(0, 2, 1, 1);
            }
          }
        }
        // up
        /*else if (e.which == 38){
          this.upUp = true;
          if (this._movement.x < 0){
            this.stop().animate("walk_left", 15, -1);
          }
          else if (this._movement.x > 0){
            this.stop().animate("walk_right", 15, -1);
          }
          else{
            if (this.__coord[1] == 124){
              this.sprite(0, 0, 1, 1);
            }
            else{
              this.sprite(0, 1, 1, 1);
            }
          }
        }*/
      })
      .onHit('Chest', function(c){
        Crafty.audio.play('ding');
        var chestContents = c[0]["obj"].contents;
        switch(chestContents){
          case "LaserPistol":
            this.laserPistol = 1;
            this.currentWeapon = "LaserPistol";
            Crafty("WeaponIcon").changeWeapon("LaserPistol");
            Crafty("AmmoCount").text("&infin;");
            Crafty("Status").text("This laser pistol should take care of those haywire robots.<br />Even if it is a little weak.  (Fire: X)");
            break;
          case "EnergyRifle":
            this.energyRifle = 3;
            this.currentWeapon = "EnergyRifle";
            Crafty("WeaponIcon").changeWeapon("EnergyRifle");
            Crafty("AmmoCount").text("3");
            Crafty("Status").text("Awesome, a proper weapon.  This energy rifle is more powerful,<br />but it needs to be recharged at checkpoints.  (Change Weapon: C)");
            break;
          case "PlasmaCannon":
            this.plasmaCannon = 1;
            this.currentWeapon = "PlasmaCannon";
            Crafty("WeaponIcon").changeWeapon("PlasmaCannon");
            Crafty("AmmoCount").text("1");
            Crafty("Status").text("A plasma cannon!  Maybe if I search the equipment back there,<br />I'll find a jetpack I can use to fly up to the mothership.");
            break;
          case "jetpack":
            this.jetpack = 1;
            this.maxO2 += 360;
            Crafty("Status").text("Finally, a jetpack!  Now I can jump in midair.<br />Integrated air tanks increase max air supply to " + this.maxO2/120 + ".");
            break;
          case "o2":
            this.maxO2 += 120;
            Crafty("Status").text("Found an air canister.<br />Maximum air supply increased to " + this.maxO2/120 + ".");
            break;
          case "hp":
            this.maxHp++;
            Crafty("Status").text("Found an energy cell.<br />Maximum health increased to " + this.maxHp + ".");
            break;
          case "EnergyRifleAmmo":
            this.energyRifle += 3;
            Crafty("Status").text("Picked up an energy rifle cartridge.<br />Energy rifle ammo increased by 3.");
            if (this.currentWeapon == "EnergyRifle"){
              Crafty("AmmoCount").text(this.energyRifle);
            }
            break;
          case "PlasmaCannonAmmo":
            this.plasmaCannon++;
            Crafty("Status").text("Picked up a plasma cannon cartridge.<br />Plasma cannon ammo increased by 1.");
            if (this.currentWeapon == "PlasmaCannon"){
              Crafty("AmmoCount").text(this.plasmaCannon);
            }
            break;
        }
        if (c[0]["obj"].id != -1){
          this.openedChests.push(c[0]["obj"].id);
        }
        c[0]["obj"].destroy();
      })
      .onHit('DrainO2', function(c){
        this.decrementO2();
      })
      .onHit('ChangeLevel', function(c){
        var oldLevel = Crafty._current;
        var newLevel = c[0]["obj"].level;
        this._movement.x = 0;
        if (oldLevel == "Ship"){
          this.knockback = 60;
        }
        Crafty.scene(newLevel);
        if (newLevel == "Overworld"){
          if (oldLevel == "Ship"){
            this.at(23, 3);
          }
          else if (oldLevel == "Cavern"){
            this.checkpoint.x = 82;
            this.checkpoint.y = 17;
            this.at(82,17);
          }
          else if (oldLevel == "Mothership"){
            this.checkpoint.x = 135;
            this.checkpoint.y = 2;
            this.at(135,2);
          }
        }
      })
      .onHit("Spikes", function(c){
        this.die();
      })
      .onHit("Spawner", function(c){
        var spawner = c[0]["obj"];
        if (spawner.__coord[1] == 32){ // inactive spawner
          Crafty.audio.play('ding');
          Crafty("Spawner").each(function(){
            this.sprite(480, 32, 48, 64);
          });
          spawner.sprite(496, 304, 48, 64);
          this.checkpoint = {
                              "x": spawner._x,
                              "y": spawner._y
                            };
          this.hp = this.maxHp;
          this.redrawBars();
          if (this.energyRifle != -1){
            this.energyRifle = 3;
          }
          if (this.plasmaCannon != -1){
            this.plasmaCannon = 1;
          }
          if (this.currentWeapon == "EnergyRifle"){
            Crafty("AmmoCount").text(this.energyRifle);
          }
          else if (this.currentWeapon == "PlasmaCannon"){
            Crafty("AmmoCount").text(this.plasmaCannon);
          }
        }
      })
      .onHit("Enemy", function(c){
        if (c[0]["obj"]._x + c[0]["obj"]._w/2 < this._x + this._w/2){
          this.x += 4;
          if (!this.hit("Solid")){
            this._movement.x = 4;
          }
          this.x -= 4;
        }
        else{
          this.x -= 4;
          if (!this.hit("Solid")){
            this._movement.x = -4;
          }
          this.x += 4;
        }
        this._movement.y = -2;
        this.knockback = 30;
        this.decrementHp(1);
      })
      .onHit("Boss", function(c){
        this._movement.x *= -1;
        this._movement.y *= -1;
        this.decrementHp(1);
      })
      .onHit("Drone", function(c){
        this.die();
      })
      .onHit("EscapePod", function(c){
        setTimeout(function(){Crafty("EscapePod")._movement.y = -8}, 2000);
        setTimeout(function(){Crafty.scene("Credits")}, 5000);
        Crafty("Persist").each(function(){
          this.destroy();
        });
      })
      .onHit("EnemyBullet", function(c){
        this.decrementHp(c[0]["obj"].dmg + 1);
        c[0]["obj"].destroy();
      });
  },
  
  decrementHp: function(h){
    for (var i = 0; i <= h; i++){
      Crafty("health" + (this.hp - i)).visible = false;
    }
    this.hp -= h;
    if (this.hp <= 0){
      this.die();
    }
    else{
      Crafty.audio.play('playerhit');
    }
  },
  
  decrementO2: function(){
    //console.log("decrementO2");
    this.o2--;
    if (this.o2 % 120 == 0){
      Crafty("oxygen" + (this.o2/120)).each(function(){
        this.visible = false;
      });
    }
    if (this.o2 <= 0){
      this.die();
    }
  },
  
  incrementO2: function(){
    //console.log("incrementO2");
    if (this.o2 < this.maxO2){
      //console.log(this.o2);
      this.o2 += 4;
      this.o2 -= (this.o2 % 4); // floor to multiple of 4 to prevent missing key values
      if (this.o2 % 120 == 0){
        Crafty("oxygen" + ((this.o2 - 120)/120)).each(function(){
          this.visible = true;
        });
      }
    }
  },
  
  die: function(){
    if (this.dead == -1){
      Crafty("HealthIcon").each(function(){
        this.visible = false;
      });
      Crafty("OxygenIcon").each(function(){
        this.visible = false;
      });
      this._movement.x = 0;
      this._movement.y = 0;
      this.visible = false;
      this.leftUp = true;
      this.rightUp = true;
      this.upUp = true;
      Crafty.audio.play('playerkilled');
      this.dead = 120;
    }
  },
  
  respawn: function(){
    this._movement.x = 0;
    this._movement.y = 0;
    this.x = this.checkpoint.x;
    this.y = this.checkpoint.y;
    this.stop().sprite(0, 0, 1, 1);
    this.visible = true;
    if (Crafty._current != "Mothership"){
      Crafty("Enemy").each(function(){
        this.destroy();
      });
      window["spawn" + Crafty._current + "Enemies"]();
      Crafty("EnemyBullet").each(function(){
        this.destroy();
      });
    }
    else{
      Crafty.scene("Mothership");
    }
    if (this.plasmaCannon != -1){
      this.plasmaCannon = 1;
    }
    if (this.energyRifle != -1){
      this.energyRifle = 3;
    }
    if (this.currentWeapon == "EnergyRifle"){
      Crafty("AmmoCount").text(this.energyRifle);
    }
    else if (this.currentWeapon == "PlasmaCannon"){
      Crafty("AmmoCount").text(this.plasmaCannon);
    }
    this.o2 = this.maxO2;
    this.hp = this.maxHp;
    this.redrawBars();
  },
  
  redrawBars: function(){
    for (var i = 0; i < this.o2 / 120; i++){
      Crafty("oxygen" + i).each(function(){
        this.visible = true;
      });
    }
    for (var i = 0; i < this.hp; i++){
      Crafty("health" + i).each(function(){
        this.visible = true;
      });
    }
  }
});

Crafty.c('HealthIcon', {
  init: function(){
    this.requires('Actor, Persist, spr_health_icon')
      .addComponent('GUI');
  }
});

Crafty.c('OxygenIcon', {
  init: function(){
    this.requires('Actor, Persist, spr_oxygen_icon')
      .addComponent('GUI');
  }
});

Crafty.c('WeaponIcon', {
  init: function(){
    this.requires('Actor, Persist, spr_laser_pistol_icon');
    this.visible = false;
    this.addComponent('GUI');
  },
  changeWeapon: function(weaponName){
    switch(weaponName){
      case "LaserPistol":
        this.sprite(2, 0, 1, 1);
        this.visible = true;
        break;
      case "EnergyRifle":
        this.sprite(3, 0, 1, 1);
        this.visible = true;
        break;
      case "PlasmaCannon":
        this.sprite(4, 0, 1, 1);
        this.visible = true;
        break;
    }
  }
});

Crafty.c('AmmoCount', {
  init: function(){
    this.requires('2D, DOM, Text, Persist')
      .css({"color":"#FFFFFF", "font-family":"Lucida Sans Unicode, Lucida Grande, sans-serif", "text-align": "right"})
      .addComponent('GUI');
  }
});

Crafty.c('Bullet', {
  tick: 60*2,
  init: function(){
    this.requires('Actor, Multiway, Collision, Persist')
      .multiway(2)
      .onHit("Solid", function(c){
        //this.destroy();
        if (!c[0]["obj"].has("Wall")){
          this.reset();
          if (this.has("PlasmaCannonBullet")){
            Crafty.audio.play("explode");
          }
        }
      })
      .bind("EnterFrame", function(){
        if (this.x != -100 && this.y != 100){
          this.tick--;
        }
        if (this.tick <= 0){
          this.reset();
        }
      });
  },
  fire: function(){
    var pc = Crafty("PlayerCharacter");
    if (!pc.upUp){
      this._movement.y = -4;
    }
    else{
      if (Crafty("PlayerCharacter").__coord[1] == 0){
        this._movement.x = 4;
      }
      else if (Crafty("PlayerCharacter").__coord[1] == 62){
        this._movement.x = -4;
      }
    }
  },
  reset: function(){
    this._movement.x = 0;
    this._movement.y = 0;
    this.x = -100;
    this.y = -100;
    this.tick = 60*2;
  }
});

Crafty.c("LaserPistolBullet", {
  dmg: 1,
  init: function(){
    this.requires("Bullet, spr_laser_pistol_bullet")
      .onHit("Wall", function(){
        this.reset();
      });
  }
});

Crafty.c("EnergyRifleBullet", {
  dmg: 3,
  init: function(){
    this.requires("Bullet, spr_energy_rifle_bullet")
      .onHit("Wall", function(){
        this.reset();
      });
  }
});

Crafty.c("PlasmaCannonBullet", {
  dmg: 10,
  init: function(){
    this.requires("Bullet, spr_plasma_cannon_bullet");
  }
});

Crafty.c('Chest', {
  init: function(){
    this.requires('Actor, spr_chest');
  },
  contents: "",
  id: -1
});

Crafty.c('Enemy', {
  tick: 0,
  oldMovement: 0,
  hp: 3,
  init: function(){
    this.requires('Actor, Collision, Multiway')
      .multiway(2)
      .onHit("EnemySolid", function(){
        this._movement.x *= -1;
        if (this._movement.x > 0){
          this.flip();
        }
        else{
          this.unflip();
        }
      })
      .onHit("Bullet", function(c){
        var b = c[0]["obj"];
        b.reset();
        this.hp -= b.dmg;
        if (this.hp <= 0){
          Crafty.audio.play("explode");
          this.destroy();
        }
        else if (b.has("PlasmaCannonBullet")){
          Crafty.audio.play("explode");
        }
        else{
          Crafty.audio.play("enemyhit");
        }
      });
    this._movement.x = 2;
    this.flip();
  },
  shoot: function(b, dx, dy){
    var newbullet = Crafty.e("EnemyBullet").requires("spr_enemy_bullet_" + b).attr({dmg:b}).collision().attr({x:this._x+this._w/2, y:this._y+this.h/2});
    newbullet._movement.x = dx;
    newbullet._movement.y = dy;
  },
  shootTop: function(b, dx, dy){
    var newbullet = Crafty.e("EnemyBullet").requires("spr_enemy_bullet_" + b).attr({dmg:b}).collision().attr({x:this._x+this._w/2, y:this._y});
    newbullet._movement.x = dx;
    newbullet._movement.y = dy;
  }
});

Crafty.c('Enemy0', {
  init: function(){
    this.requires('Enemy, spr_enemy0')
      .collision();
  }
});

Crafty.c('Enemy1', {
  init: function(){
    this.requires('Enemy, spr_enemy1')
      .collision()
      .bind("EnterFrame", function(){
        if (this.tick == 120){
          this.oldMovement = this._movement.x;
          this._movement.x = 0;
        }
        if (this.tick == 150){
          this.shoot(0, 2*this.oldMovement/Math.abs(this.oldMovement), 0);
        }
        if (this.tick == 180){
          this._movement.x = this.oldMovement;
          this.tick = 0;
          return;
        }
        this.tick++;
      });
  }
});

Crafty.c('Enemy2', {
  init: function(){
    this.requires('Enemy, spr_enemy2')
      .collision()
      .attr({hp:6})
      .bind("EnterFrame", function(){
        if (this.tick == 120){
          this.oldMovement = this._movement.x;
          this._movement.x = 0;
        }
        if (this.tick == 150){
          this.shoot(1, 2*this.oldMovement/Math.abs(this.oldMovement), 0);
        }
        if (this.tick == 180){
          this._movement.x = this.oldMovement;
          this.tick = 0;
          return;
        }
        this.tick++;
      });
    this._movement.x = 1;
  }
});

Crafty.c('Enemy3', {
  init: function(){
    this.requires('Enemy, spr_enemy3')
      .collision()
      .attr({hp:9})
      .bind("EnterFrame", function(){
        if (this.tick == 120){
          this.oldMovement = this._movement.x;
          this._movement.x = 0;
        }
        if (this.tick == 150){
          this.shoot(2, 2*this.oldMovement/Math.abs(this.oldMovement), 0);
        }
        if (this.tick == 180){
          this._movement.x = this.oldMovement;
          this.tick = 0;
          return;
        }
        this.tick++;
      });
    this._movement.x = 1;
  }
});

Crafty.c('Enemy4', {
  init: function(){
    this.requires('Enemy, spr_enemy4')
      .collision()
      .attr({hp:100})
      .bind("EnterFrame", function(){
        var dir = 2;
        if (this._x > 200){
          dir = -2;
        }
        if (this.tick != -1){
          /*if (this.tick == 150){
            this.shoot(0, dir, 0);
          }
          else if (this.tick == 165){
            this.shoot(0, dir, 0);
          }
          else if (this.tick == 180){
            this.shoot(0, dir, 0);
            this.tick = 0;
          }
          else if (this.tick == 195){
            this.shoot(0, dir, 0);
          }
          else if (this.tick == 210){
            this.shoot(0, dir, 0);
            this.tick = 0;
          }*/
          if (this.tick == 180){
            this.shoot(2, dir, 0);
            this.tick = 0;
          }
          this.tick++;
        }
      });
    this._movement.x = 0;
  }
});

Crafty.c('Enemy5', {
  init: function(){
    this.requires('Enemy, spr_enemy5')
      .collision()
      .attr({hp:6})
      .bind("EnterFrame", function(){
        var p = Crafty("PlayerCharacter");
        if (Math.abs(p._x - this._x) <= 700){
          if (this.tick == 150){
            var pv = new Crafty.math.Vector2D(p._x, p._y);
            var tv = new Crafty.math.Vector2D(this._x, this._y);
            var a = tv.angleTo(pv);
            var xdir = 2*Math.cos(a);
            if (xdir > 0){
              this.flip();
            }
            else if (xdir < 0){
              this.unflip();
            }
            this.shootTop(1, 2*Math.cos(a), 2*Math.sin(a));
            this.tick = 0;
            return;
          }
          this.tick++;
        }
      });
    this._movement.x = 0;
    this.unflip();
  }
});

Crafty.c('Enemy7', {
  init: function(){
    this.requires('Enemy, spr_enemy7')
      .collision()
      .attr({hp:100})
      .bind("EnterFrame", function(){
        if (this.tick != -1){
          var p = Crafty("PlayerCharacter");
          if (Math.abs(p._x - this._x) <= 700){
            if (this.tick == 180){
              var pv = new Crafty.math.Vector2D(p._x, p._y);
              var tv = new Crafty.math.Vector2D(this._x, this._y);
              var a = tv.angleTo(pv);
              var xdir = 2*Math.cos(a);
              this.shootTop(2, 2*Math.cos(a), 2*Math.sin(a));
              this.tick = 0;
              return;
            }
            this.tick++;
          }
        }
      });
    this._movement.x = 0;
  }
});

Crafty.c('EnemyBullet', {
  init: function(){
    this.requires('Actor, Multiway, Collision')
      .multiway(2)
      .onHit("Solid", function(){
        this.destroy();
      });
  }
});

Crafty.c('ChangeStatus', {
  msg: "",
  init: function(){
    this.requires('Actor, Collision')
      .onHit("PlayerCharacter", function(){
        Crafty("Status").text(this.msg);
        this.destroy();
      });
  }
});

Crafty.c('Spawner', {
  init: function(){
    this.requires('Actor, spr_spawner_inactive, Collision');
  }
});

Crafty.c('Refill', {
  init: function(){
    this.requires('Actor, spr_refill, Collision');
  }
});

Crafty.c("Wall", {
  init: function(){
    this.requires("Actor, spr_wall, Collision, Solid")
      .onHit("PlasmaCannonBullet", function(c){
        c[0]["obj"].reset();
        Crafty.audio.play("explode");
        Crafty("Wall").each(function(){
          this.destroy();
        });
      });
  }
});

Crafty.c("Airlock", {
  init: function(){
    this.requires("Actor, spr_airlock, Collision, Solid");
  }
});

Crafty.c("EscapePod", {
  init: function(){
    this.requires("Actor, spr_escape_pod, Multiway, Collision")
      .multiway(2);
  }
});

Crafty.c('Spikes', {
  init: function(){
    this.requires('Actor, Collision, spr_spikes_up');
  },
  changeDirection: function(dir){
    switch(dir){
      case 'left':
        this.sprite(512, 400, 32, 32);
        break;
      case 'up':
        this.sprite(544, 400, 32, 32);
        break;
      case 'right':
        this.sprite(576, 400, 32, 32);
        break;
      case 'down':
        this.sprite(608, 400, 32, 32);
        break;
    }
  }
});

Crafty.c('ChangeLevel', {
  level: "",
  init: function(){
    this.requires('Actor, Collision');
  }
});

Crafty.c('StartBossFight', {
  tick: -1,
  init: function(){
    this.requires('Actor, Collision')
      .onHit("PlayerCharacter", function(){
        if (this.tick == -1){
          this.tick = 0;
        }
      })
      .bind("EnterFrame", function(){
        if (this.tick != -1){
          if (this.tick == 0){
            var pc = Crafty("PlayerCharacter");
            pc.knockback = 221;
            pc._movement.x = 0;
            pc.leftUp = true;
            pc.rightUp = true;
            pc.stop().sprite(0, 0, 1, 1);
            Crafty.e("Airlock").at(6,17);
            Crafty.e("Airlock").at(27,17);
            Crafty.audio.play("explode");
          }
          else if (this.tick == 60){
            Crafty("Wall0").each(function(){
              this.destroy();
            });
            Crafty.audio.play("explode");
          }
          else if (this.tick >= 120 && this.tick % 10 == 0 && this.tick <= 220){
            Crafty("Wall" + (this.tick / 10 - 11)).each(function(){
              this.destroy();
            });
            Crafty.audio.play("explode");
          }
          else if (this.tick == 221){
            Crafty.audio.play("bgm_boss");
            Crafty("Enemy").each(function(){
              //this.tick = Math.floor(Math.random()*50);
              this.tick = 0;
            });
            Crafty("Boss").tick = 0;
            this.destroy();
          }
          this.tick++;
        }
      });
  }
});

Crafty.c("Boss", {
  tick: -1,
  hp: 250,
  init: function(){
    this.requires("Actor, spr_boss, Collision")
      .collision(new Crafty.polygon([0,0],[256,0],[256,85],[235,200],[160,200],[160,262],[102,262],[102,200],[27,200],[6,85],[6,0]))
      .bind("EnterFrame", function(){
        if (this.tick != -1){
          if (this.tick == 120){
            Crafty.e("Drone").at(16.5, 8.5);
            this.tick = 0;
          }
          this.tick++;
        }
      })
      .onHit("Bullet", function(c){
        var b = c[0]["obj"];
        b.reset();
        this.hp -= b.dmg;
        if (this.hp <= 0){
          Crafty.audio.stop("bgm_boss");
          Crafty.audio.play("explode");
          for (var i = 1; i < 20; i++){
            setTimeout(function(){Crafty.audio.play("explode");}, 125*i);
          }
          this.destroy();
          Crafty("Enemy").each(function(){
            this.destroy();
          });
          Crafty("EnemyBullet").each(function(){
            this.destroy();
          });
          Crafty("Drone").each(function(){
            this.destroy();
          });
          Crafty("Airlock").each(function(){
            this.destroy();
          });
        }
        else if (b.has("PlasmaCannonBullet")){
          Crafty.audio.play("explode");
        }
        else{
          Crafty.audio.play("enemyhit");
        }
      });
  }
});

Crafty.c("Drone", {
  hp: 3,
  init: function(){
    this.requires("Actor, spr_drone, Multiway, Collision")
      .multiway(2)
      .onHit("Bullet", function(c){
        var b = c[0]["obj"];
        b.reset();
        this.hp -= b.dmg;
        if (this.hp <= 0){
          Crafty.audio.play("explode");
          if (Math.round(Math.random()) == 0){
            Crafty.e('Chest').attr({x: this._x+29-16, y: this._y+62-32, contents:'EnergyRifleAmmo'});
          }
          else{
            Crafty.e('Chest').attr({x: this._x+29-16, y: this._y+62-32, contents:'PlasmaCannonAmmo'});
          }
          this.destroy();
        }
        else{
          Crafty.audio.play("enemyhit");
        }
      })
      .onHit("Solid", function(){
        this._movement.x = 0;
        this._movement.y = 0;
      });
    this._movement.x = Math.random()*3-1.5;
    this._movement.y = 2;
  }
});