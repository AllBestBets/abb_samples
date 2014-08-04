var arb2_hash = {
    arb: {
        arb_formula_id: 1,
        bet1_id: 1,
        bet2_id: 2,
        bet3_id: null
    },
    bets: [
        { id: 1, koef: 2.0, commission: 0 },
        { id: 2, koef: 2.0, commission: 0 }
    ]
};

var arb3_hash = {
    arb: {
        arb_formula_id: 1,
        bet1_id: 1,
        bet2_id: 2,
        bet3_id: 3
    },
    bets: [
        { id: 1, koef: 2.0, commission: 0 },
        { id: 2, koef: 2.0, commission: 0 },
        { id: 3, koef: 2.0, commission: 0 }
    ]
};

StandaloneCalculatorView = CalculatorView.extend({
    change_outcomes: function (e) {
        var arb_formulas = App.arb_formulas.where({outcomes: parseInt($("#outcomes_count").val())});
        var fragment = document.createDocumentFragment();
        _(arb_formulas).each(function (f) {
            var opt = document.createElement('option');
            opt.value = f.id;
            opt.innerHTML = f.get('name')
            fragment.appendChild(opt);
        });
        $("#formula_select").empty();
        $("#formula_select").append(fragment);
        $("#formula_select").change();
        return true;
    },

    change_formula: function (e) {
        var arb_formula = App.arb_formulas.get(parseInt($("#formula_select").val()));
        if (arb_formula.get('outcomes') == 2) {
            this.model.outcome3 = null;
            this.model.parse(arb2_hash);
        } else if (arb_formula.get('outcomes') == 3) {
            this.model.parse(arb3_hash);
        }
        var bet_names = arb_formula.get('name').replace(/#( |)\d+ /, '').match(/[\wА-Яа-яёЁ]+(\([0-9\.+-]+\)|)/g);
        for (var i = 0; i < bet_names.length; i++) {
            this.model.bets[i].set('name', bet_names[i]);
        }

        this.model.set('arb_formula_id', arb_formula.id);
        $("#formula").val(arb_formula.get('calc_formula'));
        this.render();

        return true;
    },

    render: function () {
        var bookmaker_currencies, calc, currencies, init, key, round_stake, usd;

        init = 1;
        if (!this.model.outcome3) {
            this.calc_formula = this.get_calc_formula(1);
            calc = this.get_formula(1)(this.model.outcome1.get('koef_commissed'), this.model.outcome2.get('koef_commissed')).calc;
        } else {
            this.calc_formula = this.get_calc_formula(this.model.arb_formula().get('calc_formula'));
            calc = this.get_formula(this.model.arb_formula().get('calc_formula'))(this.model.outcome1.get('koef_commissed'), this.model.outcome2.get('koef_commissed'), this.model.outcome3.get('koef_commissed')).calc;
        }
        if (!calc) {
            return this;
        }
        currencies = App.currencies;
        rates = [];
        currencies.each(function (c) {
            rates[c.id] = c.get('rate');
        });
        this.rates = rates;
        bookmaker_currencies = JSON.parse($.cookie('bookmaker_currencies') || "{}");
        round_stake = parseFloat($.cookie('round_stake')) || 0.01;
        usd = App.currencies.findWhere({
            code: 'USD'
        }).id;
        this.$el.find('.calc').html(this.template({
            arb: this.model,
            init: init,
            access_token: this.options.access_token,
            calc: calc,
            round_stake: round_stake,
            currencies: currencies,
            bookmaker_currencies: bookmaker_currencies,
            usd: usd,
            calculator_outcome_template: this.outcome_template,
            calculator_outcome_lay_template: this.outcome_lay_template
        }));
        this.reload_formula();
        ZeroClipboard.setDefaults({moviePath: "js/ZeroClipboard.swf"});
        window.clip = new ZeroClipboard($('#copy_button'));
        window.clip.setText();
        window.copy1 = new ZeroClipboard($('#outcome1_copy'));
        window.copy2 = new ZeroClipboard($('#outcome2_copy'));
        if (this.model.outcome3) {
            window.copy3 = new ZeroClipboard($('#outcome3_copy'));
        }
        this.calculate();
        if (typeof bookmaker_commissions !== 'undefined') {
            for (key in bookmaker_commissions) {
                $(".commission_" + key).val(bookmaker_commissions[key]).change();
            }
        }
        if (typeof bookmaker_rates !== 'undefined') {
            for (key in bookmaker_rates) {
                $("[data-bookmaker_id=" + key + "]").val(bookmaker_rates[key]);
                $("[data-bookmaker_id=" + key + "]").next().val(rates[bookmaker_rates[key]]);
            }
        }
        if (typeof this.bookmaker_amounts !== 'undefined') {
            for (key in this.bookmaker_amounts) {
                if (this.bookmaker_amounts[key] > 0) {
                    $(".stake_" + key).val(this.bookmaker_amounts[key]).change();
                }
            }
        }
        $(".utc[data-utc]").each(function () {
            return $(this).html($.format.date($(this).data('utc'), "dd-MM HH:mm"));
        });
        $(".utc_withyear[data-utc]").each(function () {
            return $(this).html($.format.date($(this).data('utc'), "dd-MM-yyyy HH:mm"));
        });
        this.calculate();
        return this;
    }
});

I18n.locale = 'en';
_.mixin(_.string.exports());

var calculator;

$.ajax(App.host + '/api/v1/directories').done(function (response, status_code) {
    App.arb_formulas.reset(response.arb_formulas);
    App.sports.reset(response.sports);
    App.bookmakers.reset(response.bookmakers);
    App.periods.reset(response.periods);
    App.sport_periods.reset(response.sport_periods);
    App.bet_variations.reset(response.bet_variations);
    App.bet_combinations.reset(response.bet_combinations);
    App.bet_values.reset(response.bet_values);
    App.markets.reset(response.markets);
    App.market_variations.reset(response.market_variations);
    App.currencies.reset(response.currencies);

    calculator = new StandaloneCalculatorView({el: $('.calculator'), access_token: App.access_token, is_live: false});
    calculator.delegateEvents(_(calculator.events).extend({'change #outcomes_count': 'change_outcomes', 'change #formula_select': 'change_formula'}));

    var arb = new App.Models.Arb(arb2_hash, {collection: App.arbs, parse: true});
    calculator.model = arb;
    calculator.render();
    $("#outcomes_count").change();
});
