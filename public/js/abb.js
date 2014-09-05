RequestPermission = function (callback) {
    return window.Notification.requestPermission(callback);
};

desktop_notif = function (href, title, text) {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notification");
    }
    else if (Notification.permission === "granted") {
        if (!title) {
            title = 'Test';
        }
        if (!text) {
            text = 'sample notification';
        }
        var notification = new Notification(title, {body: text, icon: 'ico/apple-touch-icon-72-precomposed.png'});
        notification.onshow = function (event) {
            return setTimeout((function () {
                notification.close();
            }), 3000);
        };
        if(href) {
            notification.onclick = function (x) {
                simplepopup(href, 950, 450);
            };
        }
    }
    else if (Notification.permission !== 'denied') {
        RequestPermission(function(){
            desktop_notif(href, title, text);
        });
    }
};

simplepopup = function (url, width, height) {
    var settings, winl, wint, wnd;
    winl = 20;
    wint = 20;
    settings = "left=" + winl + ",top=" + wint + ",width=" + (width + 40) + ",height=" + (height + 40) + ",toolbar=no,menubar=no,status=yes,scrollbars=yes,resizable=no";
    wnd = window.open(url, "_blank", settings);
    return wnd.focus();
};

App = {
    Models: {},
    Views: {},
    Collections: {},
    arrow_interval: 600,
    access_token: "",
    api_token: "",
    fractional: true,
    host: "https://www.allbestbets.ru",
    timezone_offset: function () {
        return (new Date()).getTimezoneOffset() * 60 * 1000;
    },
    unix_timestamp: function (date) {
        if (date == null) {
            date = null;
        }
        if (date) {
            return Math.round((new Date(date.replace('-', '/', 'g'))).getTime() / 1000);
        } else {
            return Math.round((new Date()).getTime() / 1000);
        }
    },
    playSound: function () {
        var a, b, beepUseHtml5, d, e;

        console.log('play sound');

//        beepUseHtml5 = true;

        beepUseHtml5 = !!(document.createElement("audio").canPlayType);

        if (beepUseHtml5) {
            if (!$(".html5-beep")[0]) {
                a = {
                    ogg: "audio/ogg",
                    mp3: "audio/mpeg"
                };

                b = "<audio class=html5-beep id=html5-beep>";

                for (e in a) {
                    d = "notify." + e;
                    b += "<source src='media/" + d + "' type='" + a[e] + "'>";
                }

                b += "</audio>";
                $(b).appendTo("body");
            }

            document.getElementById("html5-beep").play();

        } else {
            $("#notify").html('<audio autoplay="autoplay"><source src="media/notify.mp3" type="audio/mpeg" /><source src="media/notify.ogg" type="audio/ogg" /><embed hidden="true" autostart="true" loop="false" src="/media/notify.mp3" /></audio>');
        }
        return false;
    }
};

Routes = {
    // go_bookmaker => /bookmakers/:id/go(.:format)
    go_bookmaker_path: function (bk, options) {
        return bk.get('affiliate_url');
    },

    // bet => /bets/:id(.:format)
    bet_path: function (bet, options) {
        if (App.access_token) {
            return "http://www.oddsfan.com/bets/" + bet.id + "?locale=en&access_token=" + App.access_token;
        } else {
            if($.type(bet.bookmaker)=="string"){
                var bookmaker = App.bookmakers.findWhere({name: bet.bookmaker});
                return this.go_bookmaker_path(bookmaker);
            } else{
                return this.go_bookmaker_path(bet.bookmaker());
            }
        }
    },

    compare_index_path: function () {
        return "/odds-comparison";
    },

    calculator_arb_path: function (id) {
        return "/arbs/" + id + "/calculator";
    }


};

(function () {

    $(document).on('click', "a.calculator_link", function () {
        simplepopup($(this).attr("href"), 770, 340);
        return false;
    });

    App.Models.Arb = Backbone.Model.extend({
        urlRoot: App.host + '/api/v1/arbs',

        destroy: function (options) {
            var url,
                _this = this;
            url = App.host + "/api/v3/arbs/" + this.id + "/exclude?api_token=" + App.api_token + "&access_token=" + App.access_token;
            console.log(url);

            $.post(url, options, function (data) {
                return $(".arb_" + _this.id).slideUp(function () {
                    return filter.refresh();
                });
            });

            return false;
        },

        fetch_wrong_items: function (success) {
            url = !App.is_live ? (App.host + "/api/v1/arbs/" + this.id + "/wrong") : (App.host + "/api/v1/arbs/live/" + this.id + "/wrong");
            console.log(url);
            $.get(url, {access_token: App.access_token}, function (data) {
                success(data);
            });
        },

        calculator_url: function () {
            var arb_data, bets, data;
            bets = [this.bet1().toJSON(), this.bet2().toJSON()];
            if (this.get('bet3_id') != null) {
                bets[2] = this.bet3().toJSON();
            }
            data = {
                arb: this.toJSON(),
                bets: bets
            };
            arb_data = JSON.stringify(data);
            return Routes.calculator_arb_path(this.get('event_id')) + "#" + arb_data;
        },

        bet1: function () {
            return this._bet1 || (this._bet1 = App.bets.get(this.get('bet1_id')));
        },
        bet2: function () {
            return this._bet2 || (this._bet2 = App.bets.get(this.get('bet2_id')));
        },
        bet3: function () {
            return this._bet3 || (this._bet3 = App.bets.get(this.get('bet3_id')));
        },

        wrong_items: function () {
            return this._wrong_items || (this._wrong_items = App.wrong_items.get(this.get('id')));
        },

        updated_date: function () {
            return $.format.date(new Date(this.get('updated_at')), "dd-MM-yyyy HH:mm");
        },
        arb_formula: function () {
            return App.arb_formulas.get(this.get('arb_formula_id'));
        },
        to_notification: function () {
            var bookmaker1_name, bookmaker2_name, bookmaker3_name, sport_name, started_at, text, title;
            sport_name = App.sports.get(this.get('sport_id')).get('name');
            started_at = new Date(this.get('started_at') * 1000);
            title = "" + (_("%.2f").sprintf(this.get('percent'))) + "% " + sport_name + " " + (started_at.toUTCString());
            bookmaker1_name = this.bet1().bookmaker().get('name');
            bookmaker2_name = this.bet2().bookmaker().get('name');
            text = "" + (this.get('event_name')) + " (" + bookmaker1_name + "-" + bookmaker2_name;
            if (this.bet3() != null) {
                bookmaker3_name = this.bet3().bookmaker().get('name');
                text += "-" + bookmaker3_name;
            }
            text += ")";
            return {
                hash: this.get('arb_hash'),
                title: title,
                text: text
            };
        },
        validate: function (attrs) {
            return !((attrs.bet1_id != null) && (attrs.bet2_id != null));
        },
        parse: function (response) {
            var bets_raw;
            if (response.arb) {
                bets_raw = new App.Collections.Bets(response.bets);
                this.bets = new Array(3);
                this.bets[0] = bets_raw.findWhere({
                    id: response.arb.bet1_id
                });
                this.bets[1] = bets_raw.findWhere({
                    id: response.arb.bet2_id
                });
                if (response.arb.bet3_id) {
                    this.bets[2] = bets_raw.findWhere({
                        id: response.arb.bet3_id
                    });
                }
                this.outcome1 = this.bets[0];
                this.outcome2 = this.bets[1];
                if (this.bets[2]) {
                    this.outcome3 = this.bets[2];
                }
                return response.arb;
            } else {
                return response;
            }
        }
    });

    App.Collections.Arbs = Backbone.Collection.extend({
        url: App.host + '/api/v1/arbs',
        model: App.Models.Arb,

        parse: function (response) {
            App.bets.reset(response.bets);
            App.wrong_items.reset(response.wrong_items);
            return response.arbs;
        }
    });

    App.arbs || (App.arbs = new App.Collections.Arbs());

}).call(this);
(function () {
    App.Models.ArbFormulaOutcome = Backbone.Model.extend({
        test: function () {
            return true;
        }
    }, {
        spreadable: function (bet_variation, value) {
            var sign;
            if (value == null) {
                value = null;
            }
            if (bet_variation.get('reverse_id') == null) {
                return false;
            }
            sign = bet_variation.get('name').search('TU') === -1 ? '>=' : '<=';
            return {
                bet_variation_id: bet_variation.get('reverse_id'),
                value: bet_variation.get('change_sign') != null ? -value : value,
                sign: value == null ? '=' : sign
            };
        }
    });

}).call(this);
(function () {
    App.Models.ArbType = Backbone.Model.extend({
        i18n_title: function () {
            return I18n.t("arb.t_" + (this.get('identifier')));
        }
    });

    App.Collections.ArbTypes = Backbone.Collection.extend({
        model: App.Models.ArbType
    });

    App.arb_types || (App.arb_types = new App.Collections.ArbTypes());

}).call(this);
(function () {
    App.Models.WrongItem = Backbone.Model.extend({
    });

    App.Collections.WrongItems = Backbone.Collection.extend({
        model: App.Models.WrongItem
    });

    App.wrong_items || (App.wrong_items = new App.Collections.WrongItems());

}).call(this);
(function () {
    App.Models.Bet = Backbone.Model.extend({

        initialize: function () {
            var commission, koef, koef_commissed;
            koef = this.get('koef');
            commission = this.get('commission');
            koef_commissed = commission === 0 || (commission == null) ? koef : koef + (1 - koef) * commission / 100;
            return this.set('koef_commissed', koef_commissed);
        },
        destroy: function () {
            var url,
                _this = this;
            url = App.host + "/api/v3/bets/" + this.id + "/exclude_arbs?api_token=" + App.api_token + "&access_token=" + App.access_token;
            console.log(url);
            /*
             * $.post(url, {
             _method: "delete"
             }, function(data) {
             return $(".bet_" + _this.id).slideUp(function() {
             return filter.refresh();
             });
             });
             */
            return false;
        },
        print_koef: function () {
            if (this.get('koef')) {
                if (App.fractional){
                    var tolerance = 1.0E-6;
                    var h1=1; var h2=0;
                    var k1=0; var k2=1;
                    var b = this.get('koef');
                    do {
                        var a = Math.floor(b);
                        var aux = h1; h1 = a*h1+h2; h2 = aux;
                        aux = k1; k1 = a*k1+k2; k2 = aux;
                        b = 1/(b-a);
                    } while (Math.abs(this.get('koef')-h1/k1) > this.get('koef')*tolerance);

                    return h1+"/"+k1;
                }
                else {
                    return _("%.2f").sprintf(this.get('koef'));
                }
            } else {
                return 'XXX';
            }
        },
        bookmaker: function () {
            return this._bookmaker || (this._bookmaker = App.bookmakers.get(this.get('bookmaker_id')));
        },
        period: function () {
            return this._period || (this._period = App.periods.get(this.get('period_id')));
        },
        bet_combination: function () {
            return this._bet_combination || (this._bet_combination = App.bet_combinations.get(this.get('bc_id')));
        },
        market_variation: function () {
            return this._market_variation || (this._market_variation = this.bet_combination() ? this.bet_combination().market_variation() : null);
        },
        market_id: function () {
            if (this.market_variation()) {
                return this.market_variation().get('market_id');
            } else {
                return 0;
            }
        },
        swap_market: function () {
            return this._swap_market || (this._swap_market = this.market_variation().swap());
        },
        bet_variation: function () {
            return this._bet_variation || (this._bet_variation = this.bet_combination() ? this.bet_combination().bet_variation() : null);
        },
        event_display_name: function () {
            if (this.get('swap_teams')) {
                return "" + (this.get('away')) + " ↔ " + (this.get('home'));
            } else {
                return "" + (this.get('home')) + " - " + (this.get('away'));
            }
        },

        display_original_value: function (display_full_desc) {
            var bet_value, bet_variation_name, cs, html, lay, lay_variation, res, sub, swap_name, title_res;
            if (display_full_desc == null) {
                display_full_desc = true;
            }
            if (!this.bet_variation()) {
                return 'xxx';
            }
            bet_variation_name = this.bet_variation().get('name');
            bet_value = this.bet_combination().value();
            if (this.get('swap_teams') && this.swap_market() && this.swap_market() !== this.market_variation()) {
                if (bet_variation_name === 'CS' || bet_variation_name === 'CS_N' || bet_variation_name === 'SET_CS' || bet_variation_name === 'SET_CS_N') {
                    cs = bet_value.toFixed(1).toString().split(".");
                    res = _(this.market_variation().i18n_title()).sprintf("" + cs[0] + ":" + cs[1]);
                    if (display_full_desc) {
                        title_res = I18n.t('global.from') + _(this.market_variation().i18n_title()).sprintf("" + cs[1] + ":" + cs[0]);
                    }
                } else {
                    sub = "" + (bet_value > 0 && bet_variation_name.search('F') > -1 ? "+" : "") + bet_value;
                    res = _(this.market_variation().i18n_title()).sprintf(sub);
                    if (display_full_desc) {
                        swap_name = this.swap_market().get('title');
                        sub = "" + (bet_value > 0 && swap_name.search('F') > -1 ? '+' : '') + bet_value;
                        title_res = I18n.t('global.from') + " " + _(this.swap_market().i18n_title()).sprintf(sub);
                    }
                }
            } else if (this.get('swap_teams') && bet_variation_name === 'EHX') {
                res = _(this.market_variation().i18n_title()).sprintf("" + bet_value);
                if (display_full_desc) {
                    title_res = I18n.t('global.from') + _(this.market_variation().i18n_title()).sprintf(bet_value);
                }
            } else {
                sub = "" + (bet_value > 0 && bet_variation_name.search('F') > -1 ? '+' : '') + bet_value;
                if (bet_variation_name === 'CS' || bet_variation_name === 'CS_N' || bet_variation_name === 'SET_CS' || bet_variation_name === 'SET_CS_N') {
                    cs = bet_value.toFixed(1).toString().split(".");
                    sub = "" + cs[0] + ":" + cs[1];
                }
                res = _(this.market_variation().i18n_title()).sprintf(sub);
            }
            if (this.get('is_lay') && display_full_desc) {
                lay = App.Models.ArbFormulaOutcome.spreadable(this.bet_variation(), bet_value);
                lay_variation = App.market_variations.findWhere({
                    market_id: this.market_variation().get('market_id'),
                    bet_variation_id: lay.bet_variation_id
                });
                if (bet_variation_name === 'CS' || bet_variation_name === 'CS_N' || bet_variation_name === 'SET_CS' || bet_variation_name === 'SET_CS_N') {
                    cs = bet_value.toFixed(1).toString().split(".");
                    bet_value = "" + cs[0] + ":" + cs[1];
                }
                if (lay_variation != null) {
                    title_res = ("(" + (I18n.t('bet.against'))) + ' ' + _(lay_variation.i18n_title()).sprintf(bet_value) + ")";
                }
            }
            if (title_res) {
                html = _("<span title='%s'>%s</span>").sprintf(title_res, res);
            } else {
                html = res;
            }
            return html;
        },
        i18n_period_name_by_sport: function (sport_id, with_regular_time) {
            if (with_regular_time == null) {
                with_regular_time = false;
            }
            return I18n.t("bet." + (App.Models.Bet.period_name_by_sport(this.period().get('identifier'), sport_id, with_regular_time)));
        }
    }, {
        period_name_by_sport: function (period, sport_id, with_regular_time) {
            var game, set;
            if (with_regular_time == null) {
                with_regular_time = false;
            }
            period = parseInt(period);
            switch (period) {
                case -2:
                    switch (sport_id) {
                        case 6:
                            return "with overtime and shootouts";
                        default:
                            return "match";
                    }
                    break;
                case -3:
                    return "match (doubles)";
                case -1:
                    switch (sport_id) {
                        case 8:
                        case 13:
                            if (with_regular_time) {
                                return "match";
                            } else {
                                return "no_desc";
                            }
                            break;
                        default:
                            return "with overtime";
                    }
                    break;
                case 0:
                    switch (sport_id) {
                        case 1:
                        case 7:
                        case 8:
                        case 9:
                        case 11:
                        case 12:
                        case 13:
                        case 14:
                            if (with_regular_time) {
                                return "match";
                            } else {
                                return "no_desc";
                            }
                            break;
                        case 6:
                            return "60 mins";
                        default:
                            return "regular time";
                    }
                    break;
                case -19:
                case -16:
                case -13:
                case -10:
                case -7:
                    if (with_regular_time) {
                        return "match";
                    } else {
                        return "no_desc";
                    }
                    break;
                case -18:
                case -15:
                case -12:
                case -9:
                case -6:
                    return "1 time";
                case -17:
                case -14:
                case -11:
                case -8:
                case -5:
                    return "2 time";
                case -100:
                    return "next round";
                default:
                    switch (sport_id) {
                        case 11:
                            return "" + period + " frame";
                        case 8:
                        case 9:
                        case 13:
                        case 14:
                            if (period > 100) {
                                set = parseInt(period / 100);
                                game = period - set * 100;
                                return "" + set + " set, " + game + " game";
                            } else {
                                return "" + period + " set";
                            }
                            break;
                        case 6:
                            return "" + period + " period";
                        case 7:
                            return "" + period + " time";
                        case 1:
                        case 2:
                        case 10:
                        case 16:
                        case 20:
                            if (period === 10 || period === 20) {
                                return "" + (period / 10) + " half";
                            } else {
                                if (sport_id === 1) {
                                    return "" + period + " inning";
                                } else {
                                    return "" + period + " quarter";
                                }
                            }
                            break;
                        default:
                            return "" + period + " half";
                    }
            }
        }
    });

    App.Collections.Bets = Backbone.Collection.extend({
        model: App.Models.Bet
    });

    App.bets || (App.bets = new App.Collections.Bets());

}).call(this);
(function () {
    App.Models.BetCombination = Backbone.Model.extend({
        market_variation: function () {
            return this._market_variation || (this._market_variation = App.market_variations.get(this.get('mv_id')));
        },

        bet_variation: function () {
            return this._bet_variation || (this._bet_variation = App.bet_variations.get(this.market_variation().get('bet_variation_id')));
        },

        bet_value: function () {
            return this._bet_value || (this._bet_value = App.bet_values.get(this.get('value_id')));
        },

        value: function () {
            if (!this._value) {
                if (this.bet_value()) {
                    this._value = this.bet_value().get('value');
                } else {
                    this._value = '';
                }
            }
            return this._value;
        },
        display_original_value: function (display_full_desc) {
            var bet_value, bet_variation_name, cs, html, lay, lay_variation, res, sub, swap_name, title_res;
            if (display_full_desc == null) {
                display_full_desc = true;
            }
            if (!this.bet_variation()) {
                return 'xxx';
            }
            bet_variation_name = this.bet_variation().get('name');
            bet_value = this.value();
            if (this.get('swap_teams') && this.swap_market() && this.swap_market() !== this.market_variation()) {
                if (bet_variation_name === 'CS' || bet_variation_name === 'CS_N' || bet_variation_name === 'SET_CS' || bet_variation_name === 'SET_CS_N') {
                    cs = bet_value.toFixed(1).toString().split(".");
                    res = _(this.market_variation().i18n_title()).sprintf("" + cs[0] + ":" + cs[1]);
                    if (display_full_desc) {
                        title_res = I18n.t('global.from') + _(this.market_variation().i18n_title()).sprintf("" + cs[1] + ":" + cs[0]);
                    }
                } else {
                    sub = "" + (bet_value > 0 && bet_variation_name.search('F') > -1 ? "+" : "") + bet_value;
                    res = _(this.market_variation().i18n_title()).sprintf(sub);
                    if (display_full_desc) {
                        swap_name = this.swap_market().get('title');
                        sub = "" + (bet_value > 0 && swap_name.search('F') > -1 ? '+' : '') + bet_value;
                        title_res = I18n.t('global.from') + " " + _(this.swap_market().i18n_title()).sprintf(sub);
                    }
                }
            } else if (this.get('swap_teams') && bet_variation_name === 'EHX') {
                res = _(this.market_variation().i18n_title()).sprintf("" + bet_value);
                if (display_full_desc) {
                    title_res = I18n.t('global.from') + _(this.market_variation().i18n_title()).sprintf(bet_value);
                }
            } else {
                sub = "" + (bet_value > 0 && bet_variation_name.search('F') > -1 ? '+' : '') + bet_value;
                if (bet_variation_name === 'CS' || bet_variation_name === 'CS_N' || bet_variation_name === 'SET_CS' || bet_variation_name === 'SET_CS_N') {
                    cs = bet_value.toFixed(1).toString().split(".");
                    sub = "" + cs[0] + ":" + cs[1];
                }
                res = _(this.market_variation().i18n_title()).sprintf(sub);
            }
            if (this.get('is_lay') && display_full_desc) {
                lay = App.Models.ArbFormulaOutcome.spreadable(this.bet_variation(), bet_value);
                lay_variation = App.market_variations.findWhere({
                    market_id: this.market_variation().get('market_id'),
                    bet_variation_id: lay.bet_variation_id
                });
                if (bet_variation_name === 'CS' || bet_variation_name === 'CS_N' || bet_variation_name === 'SET_CS' || bet_variation_name === 'SET_CS_N') {
                    cs = bet_value.toFixed(1).toString().split(".");
                    bet_value = "" + cs[0] + ":" + cs[1];
                }
                if (lay_variation != null) {
                    title_res = ("(" + (I18n.t('bet.against'))) + ' ' + _(lay_variation.i18n_title()).sprintf(bet_value) + ")";
                }
            }
            if (title_res) {
                html = _("<span title='%s'>%s</span>").sprintf(title_res, res);
            } else {
                html = res;
            }
            return html;
        }
    });

    App.Collections.BetCombinations = Backbone.Collection.extend({
        model: App.Models.BetCombination
    });

    App.bet_combinations || (App.bet_combinations = new App.Collections.BetCombinations());
}).call(this);
(function () {
    App.Models.BetValue = Backbone.Model.extend();

    App.Collections.BetValues = Backbone.Collection.extend({
        model: App.Models.BetValue
    });

    App.bet_values || (App.bet_values = new App.Collections.BetValues());

}).call(this);
(function () {
    App.Models.Period = Backbone.Model.extend({
        initialize: function () {
            if ((this.get('values') != null) && this.get('values') !== "") {
                this.set('values', this.get('values').split(','));
            } else {
                this.set('values', null);
            }
            return true;
        }
    });

    App.Collections.Periods = Backbone.Collection.extend({
        model: App.Models.Period,
        parse: function (response) {
            if (response.sport.country.league.market) {
                return response.sport.country.league.market.period;
            } else {
                return response.sport.country.league.event.market.period;
            }
        }
    });

    App.periods || (App.periods = new App.Collections.Periods());

}).call(this);
(function () {
    App.Models.SportPeriod = Backbone.Model.extend();

    App.Collections.SportPeriods = Backbone.Collection.extend({
        model: App.Models.SportPeriod
    });

    App.sport_periods || (App.sport_periods = new App.Collections.SportPeriods());

}).call(this);
(function () {
    App.Models.BetVariation = Backbone.Model.extend({
        test: function () {
            return true;
        }
    }, {
        SWAPABLE_VARIATIONS: ['1', '2', '1X', 'X2', 'F1', 'F2', 'CNR_F1', 'CNR_F2', 'ML1', 'ML2', 'DNB1', 'DNB2', 'I1TO', 'I1TU', 'I2TO', 'I2TU', 'YC_F1', 'YC_F2', 'SET_F1', 'SET_F2', 'EH1', 'EH2'],
        swap: function (variation) {
            var name, new_name;
            name = variation.get('name');
            if (!_(App.Models.BetVariation.SWAPABLE_VARIATIONS).contains(name)) {
                return variation;
            }
            if (name.search('1') > -1) {
                new_name = name.replace(/1/, '2');
            }
            if (name.search('2') > -1) {
                new_name = name.replace(/2/, '1');
            }
            new_name = new_name.replace(/2X/, 'X2');
            new_name = new_name.replace(/X1/, '1X');
            return App.bet_variations.findWhere({
                name: new_name
            });
        }
    });

    App.Collections.BetVariations = Backbone.Collection.extend({
        model: App.Models.BetVariation
    });

    App.bet_variations || (App.bet_variations = new App.Collections.BetVariations());

}).call(this);
(function () {
    App.Models.Bookmaker = Backbone.Model.extend({
        go_link: function (options) {
            var attrs, name, title;
            if (options == null) {
                options = {};
            }
            name = this.get('name');
            title = _(I18n.t("bookmaker.Bookmaker %s")).sprintf(name);
            attrs = _(options).map(function (k, v) {
                return "" + k + "='" + v + "'";
            }).join(' ');
            return "<a href='" + (Routes.go_bookmaker_path(this)) + "' rel='nofollow' target='_blank' title='" + title + "' " + attrs + ">" + name + "</a>";
        }
    }, {
        last_update_time: function () {
            return App.bookmakers.max(function (b) {
                return b.get('last_update_time');
            }).get('last_update_time');
        },
        last_live_update_time: function () {
            return App.bookmakers.max(function (b) {
                return b.get('last_live_update_time');
            }).get('last_live_update_time');
        }
    });

    App.Collections.Bookmakers = Backbone.Collection.extend({
        model: App.Models.Bookmaker
    });

    App.bookmakers || (App.bookmakers = new App.Collections.Bookmakers());

}).call(this);
(function () {
    App.Models.BookmakerEvent = Backbone.Model.extend();

    App.Collections.BookmakerEvents = Backbone.Collection.extend({
        model: App.Models.BookmakerEvent
    });

    App.bookmaker_events || (App.bookmaker_events = new App.Collections.BookmakerEvents());

}).call(this);
(function () {
    App.Models.Market = Backbone.Model.extend({
        market_variations: function () {
            return this.variations || (this.variations = App.market_variations.where({
                market_id: this.id
            }));
        }
    });

    App.Collections.Markets = Backbone.Collection.extend({
        model: App.Models.Market,

        parse: function (response) {
            return response.sport.country.league.market || response.sport.country.league.event.market;
        }
    });

    App.markets || (App.markets = new App.Collections.Markets());

}).call(this);
(function () {
    App.Models.MarketVariation = Backbone.Model.extend({
        test: function () {
            return true;
        },
        i18n_title: function () {
            return I18n.t("market_variation." + (this.get('title')));
        },
        swap: function () {
            return App.market_variations.get(this.get('swap_id'));
        },
        variation: function () {
            return this.variation_title || (this.variation_title = this.bet_variation().get('name'));
        },
        bet_variation: function () {
            return this._bet_variation || (this._bet_variation = App.bet_variations.get(this.get('bet_variation_id')));
        }
    });

    App.Collections.MarketVariations = Backbone.Collection.extend({
        model: App.Models.MarketVariation
    });

    App.market_variations || (App.market_variations = new App.Collections.MarketVariations());

}).call(this);
(function () {
    App.Models.Sport = Backbone.Model.extend({
        i18n_name: function () {
            return I18n.t("sports." + (this.get('name')));
        }
    });

    App.Collections.Sports = Backbone.Collection.extend({
        model: App.Models.Sport
    });

    App.sports || (App.sports = new App.Collections.Sports());

}).call(this);
(function () {
    App.Models.Tariff = Backbone.Model.extend();

    App.Collections.Tariffs = Backbone.Collection.extend({
        model: App.Models.Tariff,
        light: function () {
            return this.where({
                package_id: 1
            });
        },
        standard: function () {
            return this.where({
                package_id: 2
            });
        }
    });

    App.tariffs || (App.tariffs = new App.Collections.Tariffs());

}).call(this);

(function () {
    App.Models.Currency = Backbone.Model.extend();

    App.Collections.Currencies = Backbone.Collection.extend({
        model: App.Models.Currency,
    });

    App.currencies || (App.currencies = new App.Collections.Currencies());

}).call(this);

(function () {
    App.Models.League = Backbone.Model.extend();

    App.Collections.Leagues = Backbone.Collection.extend({
        model: App.Models.League,
    });
}).call(this);

(function () {
    App.Models.Country = Backbone.Model.extend();

    App.Collections.Countries = Backbone.Collection.extend({
        model: App.Models.Country,
    });
}).call(this);

(function () {
    App.Models.Period = Backbone.Model.extend({
        initialize: function () {
            if ((this.get('values') != null) && this.get('values') !== "") {
                this.set('values', this.get('values').split(','));
            } else {
                this.set('values', null);
            }
            return true;
        }
    });

    App.Collections.Periods = Backbone.Collection.extend({
        model: App.Models.Period,

        parse: function (response) {
            if (response.sport.country.league.market) {
                return response.sport.country.league.market.period;
            } else {
                return response.sport.country.league.event.market.period;
            }
        }
    });
}).call(this);

(function () {
    App.Models.Event = Backbone.Model.extend({
        initialize: function () {
            var dt;
            dt = new Date(this.get('started_at'));
            dt.setHours(dt.getHours() + 3);
            this.event_date = $.format.date(dt, "yyyy-MM-dd");
            return this.event_time = $.format.date(dt, "HH:mm");
        },

        url: function () {
            return this.collection.url.replace(/\/leagues\/\d+/, '') + "/" + this.id;
        }
    });

    App.Collections.Events = Backbone.Collection.extend({
        model: App.Models.Event,
        comparator: 'started_at',

        parse: function (response) {
            return response.sport.country.league.event;
        }
    });
}).call(this);

(function () {
    App.Models.ArbFormula = Backbone.Model.extend();

    App.Collections.ArbFormulas = Backbone.Collection.extend({
        model: App.Models.ArbFormula,
        comparator: function (f) {
            return parseInt(f.get('calc_formula'))
        }
    });

    App.arb_formulas || (App.arb_formulas = new App.Collections.ArbFormulas());

}).call(this);

(function () {
    var Formula;

    Formula = (function () {
        function Formula() {
        }

        Formula.prototype.formula_1 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 - v;
            },
            outcomes_1_2: function (k1, k2) {
                var l, v1, v2;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                l = 1 / k1 + 1 / k2;
                v1 = 1 / (l * k1);
                v2 = 1 / (l * k2);
                return {
                    calc: {
                        stakes: [v1, v2],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2) {
                var l, ov1, ov2, v1, v2;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                l = 1 / k1 + 1 / k2;
                ov1 = 1 / (l * k1);
                ov2 = 1 / (l * k2);
                v2 = ov2 / (ov1 * k1);
                v1 = 1 - ov2 / (ov1 * k1);
                return {
                    calc: {
                        stakes: [v1, v2],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2) {
                var l, ov1, ov2, v1, v2;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                l = 1 / k1 + 1 / k2;
                ov1 = 1 / (l * k1);
                ov2 = 1 / (l * k2);
                v1 = ov1 / (ov1 * k1);
                v2 = 1 - ov1 / (ov1 * k1);
                return {
                    calc: {
                        stakes: [v1, v2],
                        percent: ((v2 * k2 - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_2 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k2 + 1 / k3;
                v1 = 1 / (l * k1);
                v2 = 1 / (l * k2);
                v3 = 1 / (l * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k3 / (k2 * k3 - k2 - k3);
                l3 = (1 + l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - k1 / k3;
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 / k2;
                l3 = (k2 - 1) * l2 - 1;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 / k2;
                l3 = (1 + l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k3 * (k1 - 1) / (k2 + k3);
                l3 = k2 * (k1 - 1) / (k2 + k3);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (1 + k1 / k3) / (k2 - 1);
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_3 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k3 + (k1 - 1) / (k1 * k2);
                v1 = 1 / (l * k1);
                v2 = (k1 - 1) / (l * k1 * k2);
                v3 = 1 / (l * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (k2 * k3 - k2 - k3);
                l3 = l2 * (k2 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - k1 / k3;
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + 1) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / k2;
                l3 = (k2 - 1) * (k1 - 1) / k2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / k2;
                l3 = (k2 + k1 - 1) / (k2 * (k3 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k3 * (k1 - 1) - 1) / (k2 + k3);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 / (k3 * (k2 - 1));
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_4 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / (k1 * k3) + (k1 - 1) / (k1 * k2);
                v1 = 1 / (l * k1);
                v2 = (k1 - 1) / (l * k1 * k2);
                v3 = 1 / (l * k1 * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (k3 * (k2 - 1));
                l3 = 1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 * k3 - k1 - k3) / (k3 - k2);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + 1) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / k2;
                l3 = (k2 - 1) * (k1 - 1) / k2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / k2;
                l3 = (1 + (1 - k2) * l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - 1 / k3;
                l3 = 1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 / (k2 + k3 * (k2 - 1));
                l3 = (k2 - 1) * l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_5 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k3 + (k1 - 0.5) / (k1 * k2);
                v1 = 1 / (l * k1);
                v2 = (k1 - 0.5) / (l * k1 * k2);
                v3 = 1 / (l * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, q, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                q = 1 / (k3 - 1);
                l2 = (q + 0.5) / (k2 - 1 - q);
                l3 = (1 + l2) * q;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - k1 / k3;
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + 1 / 2) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 0.5) / k2;
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 0.5) / k2;
                l3 = (1 + l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k3 * (k1 - 1) - 0.5) / (k3 + k2);
                l3 = (k1 - 1) - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (2 * k1 + k3) / (2 * k3 * (k2 - 1));
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_6 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / (2 * k1 * k3) + (k1 - 0.5) / (k1 * k2);
                v1 = 1 / (l * k1);
                v2 = (k1 - 0.5) / (l * k1 * k2);
                v3 = 1 / (2 * l * k1 * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (0.5 * (k3 + 1)) / ((k2 - 1) * k3);
                l3 = (1 - (k2 - 1) * l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 - k1 * k3) / (k2 - k3);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + 1 / 2) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 0.5) / k2;
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 0.5) / k2;
                l3 = (1 - (k2 - 1) * l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - 1 / (2 * k3);
                l3 = 1 / (2 * k3);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 / 2) / (k3 * (k2 - 1) + k2);
                l3 = (k2 - 1) * l2 - 0.5;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_7 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + (v1 / 2) * (k1 + 1) - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k3 + (k1 - 1) / (2 * k1 * k2);
                v1 = 1 / (l * k1);
                v2 = (k1 - 1) / (l * 2 * k1 * k2);
                v3 = 1 / (l * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 - k1 * k3 + 1) / (2 * (k2 * k3 - k2 - k3));
                l3 = (1 + l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - k1 / k3;
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + (k1 + 1) / 2) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / (2 * k2);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / (2 * k2);
                l3 = (1 + l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k3 * (k1 - 1) - (k1 + 1) / 2) / (k2 + k3);
                l3 = (k1 - 1) - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k3 - k1 * k3 + 2 * k1) / (2 * k3 * (k2 - 1));
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_8 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + (v1 / 2) * (k1 + 1) - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + (k1 - 1) / (2 * k1 * k2) + (k1 + 1) / (2 * k1 * k3);
                v1 = 1 / (l * k1);
                v2 = (k1 - 1) / (l * 2 * k1 * k2);
                v3 = (k1 + 1) / (l * 2 * k1 * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (2 - (k1 - 1) * (k3 - 1)) / (2 * k3 * (k2 - 1));
                l3 = (1 - (k2 - 1) * l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 - k1 * k3) / (k2 - k3);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                (k2 * l2 + (k1 + 1) / 2) / (1 + l2 + l3) - 1;
                l2 = (k1 - 1) / (2 * k2);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / (2 * k2);
                l3 = (1 + (1 - k2) * l2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l3 = (k1 + 1) / (2 * k3);
                l2 = k1 - 1 - l3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - (k3 * (k1 - 1)) / 2) / (k3 * (k2 - 1) + k2);
                l3 = ((k2 - 1) * l2) + (k1 - 1) / 2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_9 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 / 2 + v3 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k3 + (2 * k1 * k3 - k3 - 2 * k1) / (2 * k1 * k2 * k3);
                l2 = (2 * k1 * k3 - k3 - 2 * k1) / (2 * k2 * k3);
                v1 = 1 / (l * k1);
                v2 = l2 / (l * k1);
                v3 = 1 / (l * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (2 * (k2 - 1));
                l3 = (2 * k2 - 1) / (2 * (k2 - 1) * (k3 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - k1 / k3;
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + 1 / 2 + l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (2 * (k2 - 1));
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, q, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                q = 1 / (k3 - 1);
                l2 = (k1 - 0.5 - q) / (k2 + q);
                l3 = (1 + l2) * q;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = ((k3 - 1) * (k1 - 1) - 0.5) / (k2 + k3 - 1);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (2 * (k2 - 1));
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_10 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 / 2 + v3 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / (2 * k1 * (k3 - 1)) + 1 / k2 - 1 / (2 * k2 * k1) - 1 / (2 * (k3 - 1) * k2 * k1);
                l2 = (k1 - 0.5 - 1 / (2 * (k3 - 1))) / k2;
                v1 = 1 / (l * k1);
                v2 = l2 / (l * k1);
                v3 = 1 / (l * k1 * 2 * (k3 - 1));
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (2 * (k2 - 1));
                l3 = 1 / (2 * (k3 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 - k1 * k3) / (k2 - k3);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + 1 / 2 + l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (2 * (k2 - 1));
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (1 + (1 - k3) * (k1 - 0.5)) / (2 * k2 - 1 - k2 * k3);
                l3 = k1 - 0.5 - k2 * l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l3 = 1 / (2 * (k3 - 1));
                l2 = k1 - 1 - l3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (2 * (k2 - 1));
                l3 = (k1 - l2 * k2) / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_11 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 / 2 + v3 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k2 + 1 / k3 - 1 / (2 * k2 * k1) - 1 / (2 * k2 * k3);
                l2 = (k1 - 0.5 - k1 / (2 * k3)) / k2;
                v1 = 1 / (l * k1);
                v2 = l2 / (l * k1);
                v3 = 1 / (l * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k3 / (2 * (k3 - 1) * (k2 - 1) - 1);
                l3 = 2 * (k2 - 1) * l2 - 1;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - k1 / k3;
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + 1 / 2 + l3 / 2) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 / (2 * k1 - 1);
                l3 = 2 * (k2 - 1) * l2 - 1;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, q, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                q = 1 / (2 * (k3 - 1));
                l2 = (k1 - 0.5 - q) / (k2 + q);
                l3 = 2 * (1 + l2) * q;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = ((k3 - 0.5) * (k1 - 1) - 0.5) / (k2 + k3 - 0.5);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3) / (2 * k3 * (k2 - 1));
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_12 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 / 2 + v3 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k2 + 1 / ((2 * k3 - 1) * k1) - 1 / (2 * k2 * k1) - 1 / (2 * (2 * k3 - 1) * k2 * k1);
                l2 = (k1 - 0.5 - 1 / (2 * (2 * k3 - 1))) / k2;
                v1 = 1 / (l * k1);
                v2 = l2 / (l * k1);
                v3 = 1 / (l * k1 * (2 * k3 - 1));
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k3 / (2 * k3 * k2 - 2 * k3 - k2 + 1);
                l3 = 2 * (k2 - 1) * l2 - 1;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 - k1 * k3) / (k2 - k3);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + 1 / 2 + l3 / 2) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 / (2 * k2 - 1);
                l3 = 2 * (k2 - 1) * l2 - 1;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, q, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                q = 1 / (2 * (k3 - 1));
                l2 = (k1 - 0.5 - q) / (k2 + q * (1 - k2));
                l3 = 2 * (1 + l2 * (1 - k2)) * q;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l3 = 1 / (2 * (k3 - 0.5));
                l2 = k1 - 1 - l3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3) / (k2 + 2 * k3 * (k2 - 1));
                l3 = 2 * (k2 - 1) * l2 - 1;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_13 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return (k2 + 1) * v2 / 2 + v1 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 2 * (k1 - 1) / (k1 * (k2 + 1)) + 1 / k3 - 2 * k2 * (k1 - 1) / (k1 * k3 * (k2 + 1));
                v1 = 1 / (l * k1);
                v2 = 2 * (k1 - 1) / (l * k1 * (k2 + 1));
                v3 = (k2 + 1 + (k1 - 1) * (1 - k2)) / (l * k1 * (k2 + 1) * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (k2 - 1 + (k3 - 1) * (k2 - 1) / 2);
                l3 = (k2 - 1) / (2 * k2 - 2 + (k3 - 1) * (k2 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 - k1 * k3) / (k2 - k3);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((((k2 + 1) * l2 / 2 + 1) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 2 * (k1 - 1) / (k2 + 1);
                l3 = (k2 - 1) * (k1 - 1) / (k2 + 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 2 * (k1 - 1) / (k2 + 1);
                l3 = (k2 + 1 - 2 * (k2 - 1) * (k1 - 1)) / ((k3 - 1) * (k2 + 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k3 * (k1 - 1) - 1) / (k3 - (k2 - 1) / 2);
                l3 = (1 - ((k1 - 1) * (k2 - 1) / 2)) / (k3 - (k2 - 1) / 2);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 / (k2 + k3 * (k2 - 1) / 2);
                l3 = k1 * (k2 - 1) / (2 * k2 + k3 * (k2 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_14 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + v1 + v3 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k2 - 1 / (k1 * k2) - 1 / (2 * k1 * k2 * (k3 - 0.5)) + 1 / (k1 * (k3 - 0.5));
                l2 = (k1 - 1 - 1 / (2 * (k3 - 0.5))) / k2;
                v1 = 1 / (l * k1);
                v2 = l2 / (l * k1);
                v3 = 1 / (l * k1 * (k3 - 0.5));
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = 1 / (k2 - 1 + 2 * (k3 - 1) * (k2 - 1));
                l3 = 2 * (k2 - 1) / (k2 - 1 + 2 * (k3 - 1) * (k2 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 - k1 * k3) / (k2 - k3);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((((k2 + 1) * l2 / 2 + 1) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / (1 + 2 * (k2 - 1));
                l3 = 2 * (k2 - 1) * (k1 - 1) / (1 + 2 * (k2 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, q, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                q = (k2 - (k1 - 1) * (k2 - 1)) / ((k1 - 1) * (k3 - 1) - 0.5);
                l2 = 1 / (k2 - 1 + (k3 - 1) * q);
                l3 = q / (k2 - 1 + (k3 - 1) * q);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 - 1 - 1 / (k3 - 0.5);
                l3 = 1 / (k3 - 0.5);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = k1 / (k2 + 2 * k3 * (k2 - 1));
                l3 = 2 * (k2 - 1) * k1 / (k2 + 2 * k3 * (k2 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_15 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return v2 + (k1 + 1) * v1 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 0.5 + 1 / (2 * k1) + 1 / k3 - k2 * (k1 - 1) / (2 * k3 * k1);
                l3 = (2 * k1 - k2 * (k1 - 1)) / (2 * k3);
                v1 = 1 / (l * k1);
                v2 = (k1 - 1) / (2 * l * k1);
                v3 = l3 / (l * k1);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (1 - (k1 - 1) * (k3 - 1) / 2) / (k2 - 1);
                l3 = (k1 - 1) / 2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + k3 - k1 * k3) / (k2 - k3);
                l3 = k1 - 1 - l2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((((k1 + 1) / 2 + l2) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / 2;
                l3 = (k1 - 1) / 2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / 2;
                l3 = (1 - (k2 - 1) * (k1 - 1) / 2) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((k1 / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k3 * (k1 - 1) - (k1 + 1) / 2) / (k3 - k2 + 1);
                l3 = ((k1 + 1) / 2 - (k2 - 1) * (k1 - 1)) / (k3 - k2 + 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - k3 * (k1 - 1) / 2) / k2;
                l3 = (k1 - 1) / 2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (((k2 * l2 + k3 * l3) / (1 + l2 + l3) - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_16 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 + k2 * v2 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k1 * v1 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k2 + 1 / k3;
                v1 = 1 / (l * k1);
                v2 = 1 / (l * k2);
                v3 = 1 / (l * k3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 + v2 * k2 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1: function (k1, k2, k3) {
                var v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                v1 = 1 / (1 + k1 / k2 + (k1 / k2 + 1 - k1) / (k3 - 1));
                v2 = (v1 * k1) / k2;
                v3 = 1 - v1 - v2;
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_2: function (k1, k2, k3) {
                var v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                v1 = 1 / (1 + k1 / k3 + (k1 / k3 + 1 - k1) / (k2 - 1));
                v3 = (v1 * k1) / k3;
                v2 = 1 - v1 - v3;
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_3: function (k1, k2, k3) {
                var v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                v2 = 1 / (1 + k2 / k3 + (k2 / k3 + 1 - k2) / (k1 - 1));
                v3 = (v2 * k2) / k3;
                v1 = 1 - v2 - v3;
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2: function (k1, k2, k3) {
                var v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                v2 = 1 / (2 * k2);
                v3 = 1 / (2 * k3);
                v1 = 1 - v2 - v3;
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3: function (k1, k2, k3) {
                var v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                v1 = 1 / (2 * k1);
                v2 = 1 / (2 * k2);
                v3 = 1 - v1 - v2;
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3: function (k1, k2, k3) {
                var v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                v1 = 1 / (2 * k1);
                v3 = 1 / (2 * k3);
                v2 = 1 - v1 - v3;
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_17 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 + k2 * v2 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + (k1 + 1) * v1 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k1 + 1 / k2 + 1 / (k1 * k2) + 2 / k3;
                l2 = (k1 + 1) / (2 * k2);
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v2 * k2 + v3 * k3 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + 1) / (2 * k2);
                l3 = (1 - (k2 - 1) * (k1 + 1) / (2 * k2)) / (k3 - 1);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (1 - (k3 - 1) * k1 / k3) / (k2 - 1);
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_3_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) * (k1 - 1 / 2) / (k2 + k3 - k2 * k3);
                l3 = (k1 - 1) + (k2 - 1) * (k1 - 1) * (k1 - 1 / 2) / (k2 + k3 - k2 * k3);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k3 - (k1 - 1) / 2) / (k2 + k3 * (k2 - 1) / (k3 - 1));
                l3 = 1 / (k1 - 1) - (k2 - 1) * (2 * k3 - k1 + 1) / (2 * (2 * k2 * k3 - k2 - k3));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 + 1) / (2 * k2);
                l3 = k1 + (k2 - 1) * (k1 + 1) / (2 * k2);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / 2 + k1 * (k3 - 1) / k3;
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_18 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 + k2 * v2 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return (k3 + 1) * v3 / 2 + (k1 + 1) * v1 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = (2 * k1 + (k1 + k3) / k2 + 2 * k3) / (2 * k1 * k3 + k1 + k3);
                l3 = k1 / k3;
                l2 = (k1 + k3) / (2 * k2 * k3);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 + v2 * k2 - 1) * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) + (2 - (k2 - 1) * (k1 - 1)) / (2 * (k2 + 1));
                l3 = (2 - (k2 - 1) * (k1 - 1)) / ((k2 + 1) * (k3 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (1 - (k3 - 1) * (k1 - 1)) / (k3 * (k2 - 1));
                l3 = (k1 - 1) + (1 - (k3 - 1) * (k1 - 1)) / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_3_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / 2 + (k3 - 1) * (k1 - 1) * (k2 + 1) / (2 * (2 - (k2 - 1) * (k3 - 1)));
                l3 = (k1 - 1) * (k2 + 1) / (2 - (k2 - 1) * (k3 - 1));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_2_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = ((k3 + 1) / (2 * (k3 - 1)) - (k1 - 1) / 2) / (k2 + (k3 + 1) * (k2 - 1) / (2 * (k3 - 1)));
                l3 = 1 / (k3 - 1) - ((k2 - 1) / (k3 - 1)) * ((k3 + 1) / (2 * (k3 - 1)) - (k1 - 1) / 2) / (k2 + (k3 + 1) * (k2 - 1) / (2 * (k3 - 1)));
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_2_3_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (2 * k1 + k3 - k1 * k3) / 2;
                l3 = (k1 - 1) + (k2 - 1) * (2 * k1 + k3 - k3 * k1) / 2;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            },
            outcomes_1_3_null: function (k1, k2, k3) {
                var l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / 2 + (k3 - 1) * k1 / (2 * k3);
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: (0.0 * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_19 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 + k2 * v2 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + v1 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l = 1 / k3 + 1 / (k1 * k2);
                l2 = 1 / k2;
                l3 = k1 / k3;
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 + v2 * k2 - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_20 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 + k2 * v2 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return (k3 + 1) * v3 / 2 + v1 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k2 * v2 + k3 * v3 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (1 + ((k3 + 1) * k1) / (2 * k3) - k1) / k2;
                l3 = k1 / k3;
                l = 2 - (k1 + k2 * l2) / (1 + l2 + l3);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 + v2 * k2 - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.formula_21 = {
            revenue_1: function (k1, v1, k2, v2, k3, v3, v) {
                return k1 * v1 - v;
            },
            revenue_2: function (k1, v1, k2, v2, k3, v3, v) {
                return (k2 + 1) * v2 / 2 + (k1 + 1) * v1 / 2 - v;
            },
            revenue_3: function (k1, v1, k2, v2, k3, v3, v) {
                return k3 * v3 + k2 * v2 - v;
            },
            outcomes_1_2_3: function (k1, k2, k3) {
                var l, l2, l3, v1, v2, v3;
                k1 = parseFloat(k1);
                k2 = parseFloat(k2);
                k3 = parseFloat(k3);
                l2 = (k1 - 1) / (k2 + 1);
                l3 = (k1 - k2 * l2) / k3;
                l = 2 - k1 / (1 + l2 + l3);
                v1 = 1 / (1 + l2 + l3);
                v2 = l2 / (1 + l2 + l3);
                v3 = l3 / (1 + l2 + l3);
                return {
                    calc: {
                        stakes: [v1, v2, v3],
                        percent: ((v1 * k1 - 1) * 100).toFixed(2)
                    }
                };
            }
        };

        Formula.prototype.koef_kommissed = function (koef, commission) {
            return (parseFloat(koef) + (1 - parseFloat(koef)) * parseFloat(commission) / 100).toFixed(3);
        };

        return Formula;

    })();

    App.Formulas = new Formula;

}).call(this);

I18n.locale = 'ru';
I18n.missingTranslation = function () {
    return _.last(_.last(arguments).split("."));
};

_.mixin(_.string.exports());
