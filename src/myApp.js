var winSize;
var g_normal_bullets = [];
var g_power_bullets = [];
var g_game_layer;
var g_time = 0;
var g_props = [];
var g_player;
var g_plane1s = [];
var g_plane2s = [];
var g_plane3s = [];
var g_score;
var score_num = 0;
var bomb_num = 0;
var g_bomb;
var g_bomb_num;

//运行环境及模式
var serverMode = false;
var isNodeWebkit = (typeof process == "object");
isNodeWebkit = false;
if (isNodeWebkit) {
    var fs = require('fs');
    var net = require('net');
    var xml2js = require('xml2js');
    var parser = new xml2js.Parser();
    if (serverMode) {
        var config_file = "config.xml";
        var user_name;
        var server_ip;
        var client;
    }
}

var Bounce = {
    easeIn: function(t,b,c,d){
                return c - Bounce.easeOut(d-t, 0, c, d) + b;
    },
    easeOut: function(t,b,c,d){
                 if ((t/=d) < (1/2.75)) {
                     return c*(7.5625*t*t) + b;
                 } else if (t < (2/2.75)) {
                     return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
                 } else if (t < (2.5/2.75)) {
                     return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
                 } else {
                     return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
                 }
    },
    easeInOut: function(t,b,c,d){
                   if (t < d/2) return Bounce.easeIn(t*2, 0, c, d) * .5 + b;
                   else return Bounce.easeOut(t*2-d, 0, c, d) * .5 + c*.5 + b;
    }
};

//子弹
var Bullet = cc.Sprite.extend({
    active: false,
    speed: 15,
    power: 0,
    ctor: function (power) {
        this._super();
        this.power = power; 

        if (power == 2) 
            this.initWithFile(s_cartridge_power); 
        else
            this.initWithFile(s_cartridge); 

        this.scheduleUpdate(); 
    },
    update:function () {
        if (this.active) {
            var py = this.getPositionY();
            py += this.speed;
            this.setPositionY(py);
            if (py > winSize.height-59 || this.HP <= 0) {
                this.destroy();
            }
        }
    },
    destroy:function () {
        this.active = false;
        this.setVisible(false);
    },
    collideRect:function (p) {
        return cc.rect(p.x - 3, p.y - 3, 6, 6);
    }
});

Bullet.getOne = function (power) {
    var bullet;
    if (power == 1) {
        for (var j = 0; j < g_normal_bullets.length; j++) {
            bullet = g_normal_bullets[j];
            if (bullet.active == false) {
                bullet.setVisible(true);
                bullet.active = true;
                return bullet;
            }
        }
    } else {
        for (var j = 0; j < g_power_bullets.length; j++) {
            bullet = g_power_bullets[j];
            if (bullet.active == false) {
                bullet.setVisible(true);
                bullet.active = true;
                return bullet;
            }
        }
    }
    bullet = new Bullet(power);
    bullet.active = true;
    bullet.setVisible(true);
    if (power == 1)
        g_normal_bullets.push(bullet);
    else
        g_power_bullets.push(bullet);

    return bullet;
};

Bullet.preset = function () {
    var bullet = null;
    for (var i = 0; i < 10; i++) {
        var bullet = new Bullet(1);
        bullet.setVisible(false);
        bullet.active = false;
        g_normal_bullets.push(bullet);
        g_game_layer.addChild(bullet, 1000);
    }
    for (var i = 0; i < 10; i++) {
        bullet = new Bullet(2);
        bullet.setVisible(false);
        bullet.active = false;
        g_power_bullets.push(bullet);
        g_game_layer.addChild(bullet, 1000);
    }
};

//道具
var Prop = cc.Sprite.extend({
    active: false,
    type: 0,
    timeBegin: 0,
    func: Bounce['easeIn'],
    ctor: function (type) {
        this._super();
        this.type = type;
        if (type == 1)
            this.initWithFile(s_prop1); 
        else
            this.initWithFile(s_prop2); 

        this.scheduleUpdate(); 
    },
    update:function () {
        if (this.active) {
            var posY = this.func(this.timeBegin, 850, -900, 120);
            this.setPositionY(posY);
            this.timeBegin++;
            if (posY < 0 || this.timeBegin >= 180) {
                this.destroy();
            }
        }
    },
    destroy:function () {
        this.active = false;
        this.setVisible(false);
    },
    showUp: function () {
        this.active = true;
        this.setVisible(true);
        this.timeBegin = 0;
    }
});

Prop.preset = function() {
    var prop1 = new Prop(1);
    prop1.setVisible(false);
    g_game_layer.addChild(prop1, 1000);
    var prop2 = new Prop(2);
    prop2.setVisible(false);
    g_game_layer.addChild(prop2, 1000);

    g_props.push(prop1);
    g_props.push(prop2);
};

//飞机
var Plane = cc.Sprite.extend({
    HP: 0,
    speed: 3,
    type: 0,
    state: 0, //0: hide, 1: die, 2: show
    ctor: function(type) {
        this._super();
        this.type = type;
        switch(type) {
            case 0:
                this.HP = 1;
                this.initWithFile(s_plain1); 
                break;
            case 1:
                this.HP = 2;
                this.initWithFile(s_plain2); 
                break;
            case 2:
                this.HP = 15;
                this.initWithFile(s_plain3);
        }
        this.scheduleUpdate(); 
    },
    update: function() {
        if (this.state == 2) {
            var py = this.getPositionY();
            py -= this.speed;
            this.setPositionY(py);
            this.checkShoot();
            if (py < 0) {
                this.destroy();
            } else if (this.HP <= 0) {
                this.die();
            }
        }
    },
    checkShoot: function() {
        var rect = this.getBoundingBox();
        for (var i = 0; i < g_normal_bullets.length; i++) {
            if (g_normal_bullets[i].active) {
                if (cc.rectContainsPoint(rect, g_normal_bullets[i].getPosition())) {
                    this.HP -= 1;
                    g_normal_bullets[i].destroy();
                    return;
                }
            }
        }
        var planePos = this.getPosition();
        for (var i = 0; i < g_power_bullets.length; i++) {
            if (g_power_bullets[i].active) {
                if (cc.rectContainsPoint(g_power_bullets[i].getBoundingBox(), planePos)) {
                    this.HP -= 2;
                    g_power_bullets[i].destroy();
                    return;
                }
            }
        }
    },
    destroy:function () {
        this.stopAllActions();
        if (this.type == 0) {
            this.HP = 1;
        } else if (this.type == 1) {
            this.HP = 2;
        } else {
            this.HP = 10;
        }
        this.state = 0;
        this.setVisible(false);
    },
    die: function() {
        this.state = 1;
        var animFrames = [];
        var aFrame;
        var animation;
        if (this.type == 0) {
            aFrame = cc.SpriteFrame.create(s_plain1, cc.rect(0, 0, 59, 36));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain1_die1, cc.rect(0, 0, 59, 36));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain1_die2, cc.rect(0, 0, 59, 36));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain1_die3, cc.rect(0, 0, 59, 36));
            animFrames.push(aFrame);
            animate = cc.Animation.create(animFrames, 0.2);
            animate.setRestoreOriginalFrame(true);
            animation = cc.Animate.create(animate);
            this.runAction(cc.Sequence.create(animation, cc.CallFunc.create(this.destroy, this)));

            score_num += 100;
        } else if (this.type == 1) {
            aFrame = cc.SpriteFrame.create(s_plain2, cc.rect(0, 0, 70, 92));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain2_die1, cc.rect(0, 0, 70, 92));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain2_die2, cc.rect(0, 0, 70, 92));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain2_die3, cc.rect(0, 0, 70, 92));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain2_die4, cc.rect(0, 0, 70, 92));
            animFrames.push(aFrame);
            animate = cc.Animation.create(animFrames, 0.2);
            animate.setRestoreOriginalFrame(true);
            animation = cc.Animate.create(animate);
            this.runAction(cc.Sequence.create(animation, cc.CallFunc.create(this.destroy, this)));
            score_num += 200;
        } else if (this.type == 2) {
            aFrame = cc.SpriteFrame.create(s_plain3, cc.rect(0, 0, 165, 256));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain3_die1, cc.rect(0, 0, 165, 256));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain3_die2, cc.rect(0, 0, 165, 256));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain3_die3, cc.rect(0, 0, 165, 256));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain3_die4, cc.rect(0, 0, 165, 256));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain3_die5, cc.rect(0, 0, 165, 256));
            animFrames.push(aFrame);
            aFrame = cc.SpriteFrame.create(s_plain3_die6, cc.rect(0, 0, 165, 256));
            animFrames.push(aFrame);
            animate = cc.Animation.create(animFrames, 0.2);
            animate.setRestoreOriginalFrame(true);
            animation = cc.Animate.create(animate);
            this.runAction(cc.Sequence.create(animation, cc.CallFunc.create(this.destroy, this)));
            score_num += 1000;
        }
    }
});

Plane.preset = function() {
    var plane = null;
    for (var i = 0; i < 20; i++) {
        plane = new Plane(0);
        plane.setVisible(false);
        plane.state = 0;
        g_plane1s.push(plane);
        g_game_layer.addChild(plane, 1000);
    }
    for (var i = 0; i < 10; i++) {
        plane = new Plane(1);
        plane.setVisible(false);
        plane.state = 0;
        g_plane2s.push(plane);
        g_game_layer.addChild(plane, 1000);
    }
    for (var i = 0; i < 3; i++) {
        plane = new Plane(2);
        plane.setVisible(false);
        plane.state = 0;
        g_plane3s.push(plane);
        g_game_layer.addChild(plane, 1000);
    }
}

Plane.getOne = function(type) {
    var plane;
    if (type == 0) {
        for (var j = 0; j < g_plane1s.length; j++) {
            plane = g_plane1s[j];
            if (plane.state == 0) {
                plane.setVisible(true);
                plane.state = 2;
                return plane;
            }
        }
    } else if(type == 1){
        for (var j = 0; j < g_plane2s.length; j++) {
            plane = g_plane2s[j];
            if (plane.state == 0) {
                plane.setVisible(true);
                plane.state = 2;
                return plane;
            }
        }
    } else if(type == 2) {
        for (var j = 0; j < g_plane3s.length; j++) {
            plane = g_plane3s[j];
            if (plane.state == 0) {
                plane.setVisible(true);
                plane.state = 2;
                return plane;
            }
        }
    }
    plane= new Plane(type);
    plane.state = 2;
    plane.setVisible(true);
    if (type == 0)
        g_plane1s.push(plane);
    else if (type == 1)
        g_plane2s.push(plane);
    else if (type == 2)
        g_plane3s.push(plane);

    return plane;
}

var GameLayer = cc.Layer.extend({
    bg1:null,
    bg2:null,
    me: null,
    _state: true,
    gameKeys: [],
    init:function () {
        this._super();
        if (sys["capabilities"].hasOwnProperty('mouse'))
            this.setMouseEnabled(true);
        if (sys["capabilities"].hasOwnProperty('touches'))
            this.setTouchEnabled(true);
        if(sys["capabilities"].hasOwnProperty('keyboard'))
            this.setKeyboardEnabled(true);
        winSize = cc.Director.getInstance().getWinSize();
        Bullet.preset();
        Prop.preset();
        Plane.preset();
        
        //背景
        this.bg1 = cc.Sprite.create(s_bg);
        this.bg1.setPosition(240, 425);
        this.bg1.flag = 0;
        this.addChild(this.bg1, 1);
        this.bg2 = cc.Sprite.create(s_bg);
        this.bg2.setPosition(240, -425);
        this.bg2.flag = -1;
        this.addChild(this.bg2, 1);
        this.bgMove.call(this.bg1);
        this.bgMove.call(this.bg2);
        this.bg1.schedule(this.bgMove, 5);
        this.bg2.schedule(this.bgMove, 5);

        //玩家飞机
        g_player = cc.Sprite.create(s_me);
        g_player.setPosition(240, 80);
        this.addChild(g_player, 1000);
        g_player.myPower = 1;
        g_player.schedule(this.shoot, 1/6);

        //得分
        g_score = cc.LabelTTF.create(score_num, 'Times New Roman', 32);
        g_score.setAnchorPoint(cc.p(0, 1));
        g_score.setPosition(15, 835);
        this.addChild(g_score, 2000);

        //炸弹
        var bombItem = cc.MenuItemImage.create(s_bomb, null,
                function() {
                    bomb_num--;
                    this.bombExplosion();
                    if (bomb_num <= 0) {
                        g_bomb.setVisible(false);
                        g_bomb_num.setVisible(false);
                    }
                }, this);
        g_bomb = cc.Menu.create(bombItem);
        bombItem.setPosition(cc.PointZero());
        this.addChild(g_bomb, 2000);
        g_bomb.setPosition(cc.p(400, 41));
        g_bomb_num = cc.LabelTTF.create("x "+bomb_num, 'Times New Roman', 32);
        g_bomb_num.setAnchorPoint(cc.p(0, 0));
        g_bomb_num.setPosition(435, 22);
        g_bomb_num.setColor(cc.c3b(105, 105, 105));
        this.addChild(g_bomb_num, 2000);
        g_bomb.setVisible(false);
        g_bomb_num.setVisible(false);

        this.schedule(this.scenario, 1);
        this.scheduleUpdate(); 

        return true;
    },
    scenario: function () { //场景控制
        g_time++;
        if (g_time % 15 == 0) {
            var index = Math.floor(Math.random()*2);
            var posX = Math.round(Math.random()*420);
            g_props[index].setPosition(posX+30, 850);
            g_props[index].showUp();
        }
        var posX = Math.round(Math.random()*420);
        var plane = Plane.getOne(0);
        plane.setPosition(posX+30, 850);
        if (posX % 5 == 0) {
            var posX = Math.round(Math.random()*420);
            var plane = Plane.getOne(0);
            plane.speed = 6;
            plane.setPosition(posX+30, 850);
        }
        posX = Math.round(Math.random()*420);
        plane = Plane.getOne(0);
        plane.setPosition(posX+30, 850);
        if ((g_time+2)%5 == 0) {
            var posX = Math.round(Math.random()*410);
            var plane = Plane.getOne(1);
            plane.setPosition(posX+35, 850);
        }
        if ((g_time+7)%15 == 0) {
            var posX = Math.round(Math.random()*315);
            var plane = Plane.getOne(2);
            plane.setPosition(posX+82, 850);
        }
    },
    update: function () {
        this.checkGain(); 
        this.checkCollision();
        this.updateScore();
        this.processKeyEvent();
    },
    checkCollision: function() {
        var plane = null;
        var playerPos = g_player.getPosition();
        //var colliPos = cc.p(playerPos.x, playerPos.y+60);
        var colliRect = cc.rect(playerPos.x-13, playerPos.y-20, 26, 60);
        for (var i = 0; i < g_plane1s.length; i++) {
            plane = g_plane1s[i];
            if (plane.state == 2) {
                //if (cc.rectContainsPoint(plane.getBoundingBox(), colliPos)) {
                if (cc.rectOverlapsRect(plane.getBoundingBox(), colliRect)) {
                    this._state = false;
                    this.gameOver();
                    plane.die();
                    return;
                }
            }
        }
        for (var i = 0; i < g_plane2s.length; i++) {
            plane = g_plane2s[i];
            if (plane.state == 2) {
                //if (cc.rectContainsPoint(plane.getBoundingBox(), colliPos)) {
                if (cc.rectOverlapsRect(plane.getBoundingBox(), colliRect)) {
                    this._state = false;
                    this.gameOver();
                    plane.die();
                    return;
                }
            }
        }
        for (var i = 0; i < g_plane3s.length; i++) {
            plane = g_plane3s[i];
            if (plane.state == 2) {
                //if (cc.rectContainsPoint(plane.getBoundingBox(), colliPos)) {
                if (cc.rectOverlapsRect(plane.getBoundingBox(), colliRect)) {
                    this._state = false;
                    this.gameOver();
                    plane.die();
                    return;
                }
            }
        }
    },
    gameOver: function() {
        var animFrames = [];
        var aFrame;
        var animation;
        aFrame = cc.SpriteFrame.create(s_me_die1, cc.rect(0, 0, 98, 122));
        animFrames.push(aFrame);
        aFrame = cc.SpriteFrame.create(s_me_die2, cc.rect(0, 0, 98, 122));
        animFrames.push(aFrame);
        aFrame = cc.SpriteFrame.create(s_me_die3, cc.rect(0, 0, 98, 122));
        animFrames.push(aFrame);
        aFrame = cc.SpriteFrame.create(s_me_die4, cc.rect(0, 0, 98, 122));
        animFrames.push(aFrame);
        animation = cc.Animate.create(cc.Animation.create(animFrames, 0.3));
        g_player.runAction(cc.Sequence.create(animation, cc.CallFunc.create(this.resultScene, this)));
    },
    resultScene: function() {
        var scene = cc.Scene.create();
        var layer = new ResultLayer();
        layer.init();
        scene.addChild(layer);
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(1.2, scene));
    },
    updateScore: function() {
        g_score.setString(score_num);
    },
    checkGain: function() {
        var rect = g_player.getBoundingBox(); 
        if (g_props[0].active) {
            if (cc.rectContainsPoint(rect, g_props[0].getPosition())) {
                g_props[0].destroy();
                bomb_num++;
                if (bomb_num == 1) {
                    g_bomb.setVisible(true);
                    g_bomb_num.setVisible(true);
                }
                g_bomb_num.setString("x "+ bomb_num);
            }
        }
        if (g_props[1].active) {
            if (cc.rectContainsPoint(rect, g_props[1].getPosition())) {
                g_props[1].destroy();
                g_player.myPower = 2;
                setTimeout("g_player.myPower = 1;", 5000);
            }
        }
    },
    bombExplosion: function() {
        var plane = null;
        for (var i = 0; i < g_plane1s.length; i++) {
            plane = g_plane1s[i];
            if (plane.state == 2)
                plane.destroy();
        }
        for (var i = 0; i < g_plane2s.length; i++) {
            plane = g_plane2s[i];
            if (plane.state == 2)
                plane.destroy();
        }
        for (var i = 0; i < g_plane3s.length; i++) {
            plane = g_plane3s[i];
            if (plane.state == 2)
                plane.destroy();
        }
    },
    shoot: function () {
        var p = this.getPosition();
        if (this.myPower == 1)
            var a = Bullet.getOne(1);
        else
            var a = Bullet.getOne(2)
        a.setPosition(p.x, p.y + 70);
    },
    bgMove: function () {
        switch(this.flag) {
            case 1:
                this.setPosition(cc.p(240, -425));
            case -1:
                this.runAction(cc.MoveTo.create(5, cc.p(240, 425)));
                this.flag = 0;
                break;
            case 0:
                this.runAction(cc.MoveTo.create(5, cc.p(240, 1275)));
                this.flag = 1;
        }
    },
    onMouseDragged: function (event) {
        if (this._state) {
            var delta = event.getDelta();
            var curPos = g_player.getPosition();
            curPos = cc.pAdd(curPos, delta);
            curPos = cc.pClamp(curPos, cc.p(50, 60), cc.p(winSize.width-50, winSize.height-60));
            g_player.setPosition(curPos);
        }
    },
    onTouchesMoved:function (touches, event) {
        if (this._state) {
            var delta = touches[0].getDelta();
            var curPos = g_player.getPosition();
            curPos = cc.pAdd(curPos, delta);
            curPos = cc.pClamp(curPos, cc.p(50, 60), cc.p(winSize.width-50, winSize.height-60));
            g_player.setPosition(curPos);
        }
    },
    processKeyEvent: function () {
        var curPos = g_player.getPosition();
        if ((this.gameKeys[cc.KEY.w] || this.gameKeys[cc.KEY.up]) && curPos.y <= winSize.height - 60) {
            curPos.y += 11;
        }
        if ((this.gameKeys[cc.KEY.s] || this.gameKeys[cc.KEY.down]) && curPos.y >= 60) {
            curPos.y -= 11;
        }
        if ((this.gameKeys[cc.KEY.a] || this.gameKeys[cc.KEY.left]) && curPos.x >= 50) {
            curPos.x -= 11;
        }
        if ((this.gameKeys[cc.KEY.d] || this.gameKeys[cc.KEY.right]) && curPos.x <= winSize.width- 50) {
            curPos.x += 11;
        }
        g_player.setPosition(curPos);
    },
    onKeyDown: function (keyCode) {
        this.gameKeys[keyCode] = true;
    },
    onKeyUp: function (keyCode) {
        this.gameKeys[keyCode] = false;
    }
});

var GameScene = cc.Scene.extend({
    onEnter:function () {
        this._super();
        g_game_layer = new GameLayer();
        g_game_layer.init();
        this.addChild(g_game_layer);
    }
});

//得分结果
var ResultLayer = cc.Layer.extend({
    init: function() {
        this._super()

        if (sys["capabilities"].hasOwnProperty('mouse'))
            this.setMouseEnabled(true);
        if (sys["capabilities"].hasOwnProperty('touches'))
            this.setTouchEnabled(true);

        //背景
        var backImg = cc.Sprite.create(s_bg);
        backImg.setPosition(240, 425);
        this.addChild(backImg);

        var menuSprite = cc.Sprite.create(s_menu);
        menuSprite.setPosition(240, 400);
        this.addChild(menuSprite);
        var score = cc.LabelTTF.create(score_num, 'Times New Roman', 32);
        score.setPosition(240, 400);
        score.setColor(cc.black());
        this.addChild(score, 2);

        var continueItem = cc.MenuItemImage.create(s_cbutton, null,
                function() {
                    this.resetGame();
                    if (isNodeWebkit && serverMode) {
                        var scene = new RanklistScene();
                        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(1.2, scene));
                    } else {
                        var scene = new GameScene();
                        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(1.2, scene));
                    }
                }, this);
        var cmenu = cc.Menu.create(continueItem);
        this.addChild(cmenu, 10);
        cmenu.setPosition(cc.p(240, 273));
    },
    resetGame: function() {
        g_normal_bullets = [];
        g_power_bullets = [];
        g_game_layer = null;
        g_time = 0;
        g_props = [];
        g_player = null;
        g_plane1s = [];
        g_plane2s = [];
        g_plane3s = [];
        g_score = null;
        score_num = 0;
        bomb_num = 0;
        g_bomb = null;
        g_bomb_num;
    }
});

//游戏排名, 需要服务器支持
var RanklistScene = cc.Scene.extend({
    onEnter:function () {
        this._super();
        var layer = cc.Layer.create();

        if (sys["capabilities"].hasOwnProperty('mouse'))
            layer.setMouseEnabled(true);
        if (sys["capabilities"].hasOwnProperty('touches'))
            layer.setTouchEnabled(true);

        var data = fs.readFileSync(config_file);
        parser.parseString(data, function(err, result) {
            user_name = result.config.user[0].name[0];
            server_ip = result.config.system[0].ip[0];
            client = net.connect({port: 8124}, {host: server_ip},
            function() { //'connect' listener
                client.write(user_name + " " + score_num);
            });
            client.on('data', function(data) {
                console.log(data.toString());
                //client.end();
                var rank = data.toString().split("#");
                var len = rank.lenght;
                len = len < 6 ? len : 6;
                for (var i = 0; i < len; i++) {
                    var itemInfo = rank[i].split(":");
                    var name = cc.LabelTTF.create((i+1) + ". " + itemInfo[0] , 'Times New Roman', 32);
                    var score = cc.LabelTTF.create(itemInfo[1] , 'Times New Roman', 32);
                    name.setPosition(75, 614 - i*76);
                    name.setColor(cc.black());
                    name.setAnchorPoint(cc.p(0, 1));
                    layer.addChild(name, 2);

                    score.setPosition(410, 580 - i*76);
                    score.setColor(cc.black());
                    score.setAnchorPoint(cc.p(1, 0));
                    layer.addChild(score, 2);
                }
            });
            client.on('end', function() {
                console.log('client disconnected');
            });
        });

        //背景
        var backImg = cc.Sprite.create(s_bg);
        backImg.setPosition(240, 425);
        layer.addChild(backImg);
        
        //排行榜
        var rankSprite = cc.Sprite.create(s_ranklist);
        rankSprite.setPosition(240, 400);
        layer.addChild(rankSprite);

        var continueItem = cc.MenuItemImage.create(s_replay, null,
                function() {
                    this.resetGame();
                    var scene = new GameScene();
                    cc.Director.getInstance().replaceScene(cc.TransitionFade.create(1.2, scene));
                }, this);
        var cmenu = cc.Menu.create(continueItem);
        layer.addChild(cmenu, 10);
        cmenu.setPosition(cc.p(240, 143));

        this.addChild(layer);
    }
});
