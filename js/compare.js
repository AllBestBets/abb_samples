App.Views.Markets = Backbone.View.extend({
    template: _.template($('#markets-template').html()),

    events: {
        'click a.file': 'market_click'
    },

    initialize: function () {
        this.collection.off('reset');
        this.collection.on('reset', this.render, this);
        this.market = App.markets.get(1);
        this.periods = new App.Collections.Periods();
        return this.periods_view = new App.Views.Periods({
            collection: this.periods,
            content_view: this.options.content_view
        });
    },

    render: function () {
        this.market = this.collection.at(0);
        if (this.market == null) {
            this.options.content_view.render();
            return;
        }
        this.market.set('period', 0);
        this.$el.html(this.template({
            markets: this.collection
        }));
        $("#market_" + this.market.id).addClass('active');
        this.periods_view.setElement($(".filters .pager-select"));
        this.periods.url = this.market.url() + '/periods';
        this.periods.fetch();
        return this;
    },

    market_click: function (e) {
        var market_id;
        market_id = $(e.target).attr('market_id');
        this.show_market(market_id);
        return false;
    },

    show_market: function (market_id, callback) {
        this.$el.find('li.active').removeClass('active');
        $("#market_" + market_id).addClass('active');
        if (market_id) {
            this.market = this.collection.get(market_id);
            if (callback) {
                this.periods.once('reset', callback, this);
            }
            this.periods.url = this.market.url() + '/periods';
            return this.periods.fetch();
        }
    }
});

App.Views.Periods = Backbone.View.extend({
    template: _.template($('#periods-template').html()),

    events: {
        'click a.period_select': 'period_click'
    },

    initialize: function () {
        this.collection.off('reset');
        this.collection.on('reset', this.render, this);
        this.period = new App.Models.Period({
            identifier: 0
        });
        this.values = new App.Views.Values({
            content_view: this.options.content_view
        });
        return this;
    },

    render: function () {
        this.$el.html(this.template({
            periods: this.collection,
            sport: App.compare_controller.sport
        }));
        this.period = this.period_id != null ? this.collection.findWhere({
            identifier: this.period_id
        }) : this.collection.at(0);
        $("#period_" + (this.period.get('identifier'))).addClass('active');
        if ((this.period.get('values') != null) && this.options.content_view.show_values_select) {
            this.values.setElement(this.$el.children('.values-container'));
            this.values.collection = this.period.get('values');
            this.values.render();
            this.values_view = this.values;
        } else {
            this.values_view = null;
            this.options.content_view.render();
        }
        return this;
    },

    period_click: function (e) {
        var el;
        el = e.target;
        return this.show_period($(el).attr('period'));
    },

    show_period: function (period_id) {
        var el, url_params;
        el = $("#period_" + period_id + " a");
        this.$el.find('li.active').removeClass('active');
        $(el).parent().addClass('active');
        if (period_id) {
            this.period = this.collection.findWhere({
                identifier: period_id
            });
            if ((this.period.get('values') != null) && this.options.content_view.show_values_select) {
                this.values.setElement(this.$el.children('.values-container'));
                this.values.collection = this.period.get('values');
                this.values.render();
                this.values_view = this.values;
            } else {
                this.options.content_view.render();
            }
        }
        url_params = {
            league_id: $(el).attr('league_id')
        };
        if ($(el).attr('market_id')) {
            _(url_params).extend({
                market_id: $(el).attr('market_id')
            });
        }
        if ($(el).attr('period')) {
            _(url_params).extend({
                period: $(el).attr('period')
            });
        }
        return false;
    }
});

App.Views.Values = Backbone.View.extend({
    template: _.template($('#values-template').html()),

    events: {
        'change select.value_select': 'show_value'
    },

    render: function () {
        this.value = this.collection[0];
        is_score = /CS/.test(App.compare_controller.markets_view.market.get("short_title"));
        this.$el.html(this.template({
            values: this.collection,
            is_score: is_score
        }));
        //$(".sel").customSelect();
        this.options.content_view.render();
        this.update_market_variation_header();
        return this;
    },

    show_value: function (e) {
        var el;
        el = $(e.target);
        this.value = el.val();
        this.options.content_view.render();
        this.update_market_variation_header();
        return false;
    },

    update_market_variation_header: function () {
        var _this = this;
        return _($('a.market_variation_header')).each(function (h) {
            var val, variation;
            variation = $(h).data().variation;
            if (/(F2|EH2)/.test(variation)) {
                val = (-_this.value).toFixed(1);
            } else {
                val = _this.value;
            }
            if (/CS/.test(variation)) {
                val = _("%.1f").sprintf(parseFloat(val)).replace(/\./, ':');
            } else {
                val = parseFloat(val).toFixed(2);
            }
            return h.innerText = _($(h).data().formatStr).sprintf(val);
        });
    }
});

App.Views.Event = Backbone.View.extend({
    template: _.template($('#layout-template').html()),

    initialize: function () {
        var _this = this;
        this.markets = new App.Collections.Markets();
        this.markets.url = this.model.url() + '/markets';
        this.markets.on('reset', function () {
            return App.compare_controller.market = _this.markets.at(0);
        });
        this.bets_view = new App.Views.Bets({
            model: this.model
        });
        this.markets_view = new App.Views.Markets({
            model: this.model,
            collection: this.markets,
            content_view: this.bets_view
        });
        return App.compare_controller.markets_view = this.markets_view;
    },

    render: function () {
        this.$el.html(this.template());
        //$(".sel").customSelect();
        this.bets_view.setElement($("#filters .results-container"));
        this.markets_view.setElement($(".filters .pager:first"));
        this.markets.fetch();
        return this;
    }
});

App.Views.Bets = Backbone.View.extend({
    template: _.template($('#bets-template').html()),

    events: {
        'click a.compare_details_period_select': 'sort'
    },

    render: function () {
        var market, period, _this = this;
        market = App.compare_controller.markets_view.market;
        period = App.compare_controller.markets_view.periods_view ? App.compare_controller.markets_view.periods_view.period.get('identifier') : 0;
        $.get(this.model.url() + ("/markets/" + market.id + "/periods/" + period + "/bets"), function (data) {
            var all_bets;
            data.market = market;
            data.event = _this.model;
            data.sort_variation || (data.sort_variation = market.market_variations()[0]);
            title_template = _.template($('#event-title-template').html())
            $("#filters .title").html(title_template(data));
            all_bets = _(data.sport.country.league.event.market.period.outcome).reduce(function (bets, o) {
                _(o.bet).max(function (b) {
                    return b.odd;
                }).best = true;
                return bets.concat(_(o.bet).map(function (b) {
                    if ((o.value != null) && /(F2|EH2)/.test(o.variation)) {
                        b.value = -o.value;
                    } else {
                        b.value = o.value;
                    }
                    b.variation = o.variation;
                    return b;
                }));
            }, []);
            data.values = {};
            return _.chain(all_bets).groupBy('value').map(function (b, value) {
                if (value === 'null') {
                    value = null;
                }
                if (/CS/.test(market.get('short_title'))) {
                    value = _("%.1f").sprintf(parseFloat(value)).replace(/\./, ':');
                } else {
                    value = _this.format_value(value);
                }
                data.values[value] = _.chain(b).groupBy('bookmaker').value();
                _this.data = data;
                return _this.render_view();
            });
        });
        return this;
    },

    sort: function (e) {
        var el, _value;
        el = $(e.currentTarget);
        this.data.sort_variation = App.market_variations.get(el.data().sort);
        this.render_view();
        _value = el.data().value;
        if (_value !== "666_0") {
            $(".cycle.value_" + _value).click();
        }
        return false;
    },

    render_view: function () {
        var _this = this;
        this.data.sorted_bookmakers = {};
        _(this.data.sport.country.league.event.market.period.outcome).each(function (o) {
            var bookmakers, str_value;
            if (o.variation === _this.data.sort_variation.variation()) {
                str_value = _this.format_value(o.value);
                bookmakers = _.chain(o.bet).sortBy('odd').map(function (b) {
                    return b.bookmaker;
                }).reverse();
                return _this.data.sorted_bookmakers[str_value] = bookmakers.value();
            }
        });
        this.$el.html(this.template(this.data));
        $(".cycle").toggle(function () {
            $(this).addClass("active");
            return $(this).parents("td").find("table").fadeIn();
        }, function () {
            $(this).removeClass("active");
            return $(this).parents("td").find("table").fadeOut();
        });
        //$(".sel").customSelect();
        return $(".cycle.value_666_0").click();
    },

    format_value: function (value) {
        if (value == null) {
            value = 666.0;
        }
        if (value == 666.0) {
            return "666.0";
        } else {
            return _("%.2f").sprintf(parseFloat(value));
        }
    }

});

LeagueView = Backbone.View.extend({
    template: _.template($('#layout-template').html()),

    events: {
        'click a.compare_details': 'event_click'
    },

    initialize: function () {
        var _this = this;
        this.markets = new App.Collections.Markets();
        this.markets.on('reset', function () {
            return App.compare_controller.market = _this.markets.at(0);
        });
        this.league_events = new App.Collections.Events();
        return this.league_events.on('reset', function () {
            var data;
            data = {
                sport: App.compare_controller.sport,
                league: _this.model
            };
            title_template = _.template($('#title-template').html())
            $("#filters .title").html(title_template(data));
            //return $(".sel").customSelect();
        });
    },

    setModel: function (model) {
        this.model = model;
        this.events_view = new App.Views.Events({
            model: this.model,
            collection: this.league_events
        });
        this.markets_view = new App.Views.Markets({
            model: this.model,
            collection: this.markets,
            content_view: this.events_view
        });
        return App.compare_controller.markets_view = this.markets_view;
    },

    render: function () {
        this.markets.url = this.model.url() + '/markets';
        this.league_events.url = this.model.url() + '/events';
        this.$el.html(this.template());
        //$(".sel").customSelect();
        this.events_view.setElement($("#filters .results-container"));
        this.markets_view.setElement($(".filters .pager:first"));
        this.markets.fetch();
        return this.league_events.fetch();
    },

    event_click: function (e) {
        var el;
        el = $(e.target);
        this.show_event(el.attr('event_id'));
    },

    show_event: function (event_id, callback) {
        this.event = this.league_events.get(event_id);
        this.event_view = new App.Views.Event({
            el: this.el,
            model: this.event
        });
        if (callback) {
            this.event_view.markets.once('reset', callback, this);
        }
        this.event_view.render();
        return true;
    }
});

App.Views.Events = Backbone.View.extend({
    template: _.template($('#events-template').html()),

    initialize: function () {
        return this.show_values_select = true;
    },

    render: function () {
        var data, market, period, sport, value;
        sport = App.compare_controller.sport.toJSON();
        market = App.compare_controller.markets_view.market;
        period = App.compare_controller.markets_view.periods_view ? (App.compare_controller.markets_view.periods_view.values_view ? value = parseFloat(App.compare_controller.markets_view.periods_view.values_view.value) : void 0, App.compare_controller.markets_view.periods_view.period.get('identifier')) : 0;
        this.collection.each(function (event) {
            return $.get("/api/v2/" + sport.name + "/events/" + event.id + "/markets/" + market.id + "/periods/" + period + "/bets", function (data) {
                var event_outcomes, most_outcomes, percent;
                if (data.sport.country) {
                    event_outcomes = data.sport.country.league.event.market.period.outcome;
                } else {
                    event_outcomes = [];
                }
                most_outcomes = _(market.market_variations()).map(function (mv) {
                    var o, val, variation;
                    variation = mv.variation();
                    if ((value != null) && /(F2|EH2)/.test(variation)) {
                        val = -value;
                    } else {
                        val = value;
                    }
                    o = _(event_outcomes).find(function (eo) {
                        return (eo.variation === variation) && ((val == null) || (eo.value === val));
                    });
                    if ((o != null) && o.bet) {
                        return _(o.bet).max(function (b) {
                            return b.odd;
                        });
                    } else {
                        return null;
                    }
                });
                percent = App.compare_controller.payload(most_outcomes, market);
                tml = _.template($('#event-additional-template').html())
                $("#event_" + event.id).html(tml({
                    event: event,
                    outcome: most_outcomes,
                    percent: percent,
                    market: market,
                    sport: data.sport
                }));
            });
        });
        data = {
            sport: App.compare_controller.sport.toJSON(),
            market: App.compare_controller.markets_view.market,
            events: this.collection
        };
        this.$el.html(this.template(data));
        return this;
    }
});

SportsView = Backbone.View.extend({
    template: _.template($('#sidebar-sports-template').html()),

    render: function () {
        this.$el.html(this.template({sports: this.collection}));
        return this;
    }

});


CompareView = Backbone.View.extend({
    initialize: function () {
        this.sport_view = new SportsView({el: $("#sport-list"), collection: App.sports})
    },

    events: {
        'click a.sidebar_sport_link': 'sidebar_sport_link_click',
        'click a.sidebar_country_link': 'sidebar_country_link_click',
        'click a.sidebar_file, a.league_link': 'league_link_click',
        'click a.sport_link': 'sport_link_click',
        'click a.country_link': 'country_link_click'
    },

    render: function () {
        this.sport_view.render();

        this.leagues = new App.Collections.Leagues();
        this.countries = new App.Collections.Countries();
        this.league_view = new LeagueView({
            el: $("#content")
        });

        return this;
    },

    sidebar_sport_link_click: function (e) {
        return this.show_sport_sidebar(e.target);
    },

    sidebar_country_link_click: function (e) {
        return this.show_country_sidebar(e.target);
    },

    league_link_click: function (e) {
        var country_id, el, league_id, sport_id;
        el = $(e.target);
        if ((sport_id = el.attr("sport_id"))) {
            this.sport = App.sports.get(sport_id);
            this.leagues.url = "/api/v2/" + (this.sport.get('name')) + "/leagues";
        }
        if ((country_id = el.attr("country_id"))) {
            this.sport.country = this.countries.get(country_id);
        }
        league_id = parseInt(el.attr('league_id'));
        this.create_league(league_id);
    },

    sport_link_click: function (e) {
        return this.show_sport(e.target);
    },

    country_link_click: function (e) {
        return this.show_country(e.target);
    },

    create_league: function (league_id, callback) {
        this.league = this.leagues.get(league_id);
        this.league_view.setModel(this.league);
        if (callback) {
            this.league_view.league_events.once('reset', callback, this);
        }
        return this.league_view.render();
    },

    payload: function (bets, market) {
        var calc;
        if (_(bets).contains(null)) {
            return '-';
        }
        if (bets.length !== market.market_variations().length) {
            return '-';
        }
        if (market.get('short_title') === 'DC') {
            calc = App.Formulas.formula_16(bets[0].odd, bets[1].odd, bets[2].odd).calc;
        } else {
            if (market.market_variations().length === 3) {
                calc = App.Formulas.formula_2(bets[0].odd, bets[1].odd, bets[2].odd).calc;
            } else {
                calc = App.Formulas.formula_1(bets[0].odd, bets[1].odd).calc;
            }
        }
        return _("%.2f").sprintf(100 + parseFloat(calc.percent));
    },

    show_sport_sidebar: function (el, callback) {
        var sport_id, ul,
            _this = this;

        link = $(el);
        sport_id = $(el).attr("sport_id");
        this.sport = App.sports.get(sport_id);
        this.leagues.url = "/api/v2/" + (this.sport.get('name')) + "/leagues";

        countries = link.parent().children('ul');
        if (countries.length == 0 && !link.hasClass('opened')) {
            $.get("/api/v2/" + (this.sport.get('name')) + "/countries", function (data) {
                _this.countries.reset(data.sport.country);
                var countries_template = _.template($("#sidebar-countries-template").html());
                countries = $(countries_template(data));
                countries.css('display', 'none');
                $(link).parent().append(countries);
                countries.slideToggle('fast');
            });
        } else {
            countries.slideToggle('fast');
        }

        link.addClass('opened');
        return false;
    },

    show_sport: function (el, callback) {
        var sport_id,
            _this = this;
        sport_id = $(el).attr("sport_id");
        this.sport = App.sports.get(sport_id);
        this.leagues.url = "/api/v2/" + (this.sport.get('name')) + "/leagues";
        $.get("/api/v2/" + (this.sport.get('name')) + "/countries", function (data) {
            _this.countries.reset(data.sport.country);
            if (callback == null) {
                var sport_page = _.template($("#sport-template").html());
                $("#content").html(sport_page(data));
                _this.countries.each(function (c) {
                    return $.get("/api/v2/" + (_this.sport.get('name')) + "/countries/" + c.id + "/leagues", function (data) {
                        _this.leagues.add(data.sport.country.league);
                        var sport_leagues_page = _.template($("#sport-leagues-template").html());
                        return $("#country_" + c.id + " .sport_leagues").html(sport_leagues_page(data));
                    });
                });
            } else {
                return callback();
            }
        });
        return false;
    },

    show_country_sidebar: function (el, callback) {

        var sport_id, ul,
            _this = this;

        link = $(el);
        sport_id = $(el).attr("sport_id");
        this.country = this.countries.get($(el).attr('country_id'));
        this.sport.country = this.country;

        leagues = link.parent().children('ul');
        if (leagues.length == 0 && !link.hasClass('opened')) {
            $.get("/api/v2/" + ($(el).attr("sport")) + "/countries/" + ($(el).attr("country_id")) + "/leagues", function (data) {
                _this.leagues.add(data.sport.country.league);
                var leagues_template = _.template($("#sidebar-leagues-template").html());
                leagues = $(leagues_template(data));
                leagues.css('display', 'none');
                $(link).parent().append(leagues);
                leagues.slideToggle('fast');
            });
        } else {
            leagues.slideToggle('fast');
        }

        link.addClass('opened');
        return false;
    },

    show_country: function (el, callback) {
        var country_id,
            _this = this;
        if (callback == null) {
            callback = null;
        }
        country_id = $(el).attr("country_id") || $.url().param('country_id');
        this.country = this.countries.get(country_id);
        this.sport.country = this.country;
        $.get("/api/v2/" + (this.sport.get('name')) + "/countries/" + country_id + "/leagues", function (data) {
            _this.leagues.add(data.sport.country.league);
            if (callback == null) {

                var country_template = _.template($("#country-template").html());
                $("#content").html(country_template(data));
            } else {
                return callback();
            }
        });
        return false;
    }
});

var compare;

$.ajax('/api/v1/directories').done(function (response, status_code) {
    App.sports.reset(response.sports);
    App.bookmakers.reset(response.bookmakers);
    App.bet_variations.reset(response.bet_variations);
    App.markets.reset(response.markets);
    App.market_variations.reset(response.market_variations);

    App.compare_controller = new CompareView({el: $('.container-fluid')});
    App.compare_controller.render();
});
