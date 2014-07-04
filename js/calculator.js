I18n.locale = 'ru';
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

    var arb_json = JSON.parse(window.location.hash.replace(/#/, ''));
    arb = new App.Models.Arb({id: arb_json.id});
    calc = new CalculatorView({model: arb, el: $('.calculator'), access_token: App.access_token, is_live: false});
    arb.set(arb.parse(arb_json));
    calc.render();
});
