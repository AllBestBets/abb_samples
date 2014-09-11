CalculatorView = Backbone.View.extend({
    template: _.template($('#calculator-template').html()),
    no_arb_template: _.template($('#no-arb-template').html()),
    outcome_template: _.template($('#outcome-template').html()),
    outcome_lay_template: _.template($('#outcome-lay-template').html()),
    bookmaker_amounts: {'0': '100'},

    events: {
        'keyup .koef': 'change_koef',
        'keyup .round': 'change_round',
        'keyup .commission': 'change_commission',
        'keyup .stake': 'change_stake',
        'keyup .stake_lay': 'change_stake_lay',
        'keyup .koef_lay': 'change_koef_lay',
        'change .rate': 'change_rate',
        'keyup #round_stake': 'change_round_stake',
        'click .calculate button, .radio': 'click_calculate',
        'click .exclude_event': 'click_exclude_event',
        'click .exclude_bet': 'exclude_bet',
        'click .same_bets_refresh': 'click_same_bets_refresh',
        'change .same_bets': 'change_same_bets',
        'change .distr': 'change_distr'
    },

    get_calc_formula: function (formula) {
        return App.Formulas["formula_" + formula];
    },

    get_formula: function (formula) {
        var calc_formula, outcome_key, outcomes;
        outcomes = [];
        if ($("#outcome1_stake_distr").prop("checked")) {
            outcomes.push(1);
        }
        if ($("#outcome2_stake_distr").prop("checked")) {
            outcomes.push(2);
        }
        if ($("#outcome3_stake_distr").prop("checked") && this.model.outcome3) {
            outcomes.push(3);
        }
        if (_(outcomes).isEmpty()) {
            if (this.model.outcome3) {
                outcome_key = "1_2_3";
            } else {
                outcome_key = "1_2";
            }
        } else {
            outcome_key = outcomes.join("_");
        }
        calc_formula = this.get_calc_formula(formula)["outcomes_" + outcome_key];
        if (!calc_formula) {
            console.log("warning: formula " + formula + " for outcomes " + outcome_key + " is missing. using formula for 1_2_3 outcomes");
            $("#outcome1_stake_distr").prop("checked", "checked");
            $("#outcome2_stake_distr").prop("checked", "checked");
            $("#outcome3_stake_distr").prop("checked", "checked");
            calc_formula = this.get_calc_formula(formula)["outcomes_1_2_3"];
        } else {
            console.log("notice: using formula " + formula + " for outcomes " + outcome_key + ".");
        }
        return calc_formula;
    },

    render: function () {
        var bookmaker_currencies, calc, currencies, init, key, round_stake, usd;
        if (!this.model.isValid()) {
            this.$el.html(this.no_arb_template());
            return this;
        }

        if (!this.model.outcome3) {
            this.calc_formula = this.get_calc_formula(1);
            calc = this.get_formula(1)(this.model.outcome1.get('koef_commissed'), this.model.outcome2.get('koef_commissed')).calc;
            init = this.model.outcome1.get('updated_at') >= this.model.outcome2.get('updated_at') ? 1 : 2;
        } else {
            this.calc_formula = this.get_calc_formula(this.model.arb_formula().get('calc_formula'));
            calc = this.get_formula(this.model.arb_formula().get('calc_formula'))(this.model.outcome1.get('koef_commissed'), this.model.outcome2.get('koef_commissed'), this.model.outcome3.get('koef_commissed')).calc;
            if (this.model.outcome1.get('updated_at') >= this.model.outcome2.get('updated_at') && this.model.outcome1.get('updated_at') >= this.model.outcome3.get('updated_at')) {
                init = 1;
            } else if (this.model.outcome2.get('updated_at') >= this.model.outcome3.get('updated_at')) {
                init = 2;
            } else {
                init = 3;
            }
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
        this.$el.html(this.template({
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
        $('.same_bets_refresh').each(function () {
            return $(this).click();
        });
        $(".utc[data-utc]").each(function () {
            return $(this).html($.format.date($(this).data('utc'), "dd-MM HH:mm"));
        });
        $(".utc_withyear[data-utc]").each(function () {
            return $(this).html($.format.date($(this).data('utc'), "dd-MM-yyyy HH:mm"));
        });
        this.calculate();
        return this;
    },

    change_koef: function (e) {
        var el, id, koef_lay;
        el = e.target;
        if (e.keyCode === 188 || e.keyCode === 110) {
            $(el).val($(el).val().replace(/,/, '.'));
        }
        id = $(el).attr('id').replace(/\D/g, '');
        koef_lay = (1 + 1 / (parseFloat($(el).val()) - 1)).toFixed(3);
        $("#outcome" + id + "_koef_lay").val(koef_lay);
        this.reload_formula();
        return false;
    },

    change_round: function (e) {
        var el, id, koef_lay;
        el = e.target;
        if (e.keyCode === 188 || e.keyCode === 110) {
            $(el).val($(el).val().replace(/,/, '.'));
        }
        this.reload_formula();
        return false;
    },

    change_commission: function (e) {
        var el;
        if (e.keyCode === 188 || e.keyCode === 110) {
            el = e.target;
            $(el).val($(el).val().replace(/,/, '.'));
        }
        this.reload_formula();
        return false;
    },

    change_stake: function (e) {
        var el, id, stake_lay;
        el = e.target;
        if (e.keyCode === 188 || e.keyCode === 110) {
            $(el).val($(el).val().replace(/,/, '.'));
        }
        if (e.keyCode <= 57 && e.keyCode >= 48) {
            $("input[type='radio']", $(el).parents("tr")).attr('checked', true);
        }
        this.bookmaker_amounts['0'] = 0;
        id = $(el).attr('id').replace(/\D/g, '');
        if ($(el).attr('id') === 'total_stake' || e.keyCode === 13) {
            $("#" + $(el).attr('id') + "_fix").attr('checked', true);
            this.bookmaker_amounts['0'] = 0;
            return this.calculate(true);
        } else {
            stake_lay = ((parseFloat($("#outcome" + id + "_koef").val()) - 1) * $(el).val()).toFixed(2);
            $("#outcome" + id + "_stake_lay").val(stake_lay);
            return this.calculate_stake();
        }
    },

    change_stake_lay: function (e) {
        var el, id, stake_back;
        el = e.target;
        if (e.keyCode === 188 || e.keyCode === 110) {
            $(el).val($(el).val().replace(/,/, '.'));
        }
        id = $(el).attr('id').replace(/\D/g, '');
        stake_back = (parseFloat($(el).val()) / (parseFloat($("#outcome" + id + "_koef").val()) - 1)).toFixed(2);
        $("#outcome" + id + "_stake").val(stake_back).change();
        if (e.keyCode === 13) {
            id = $(el).attr('id').replace(/\D/g, '');
            $("#outcome" + id + "_stake_fix").attr('checked', true);
            this.calculate();
        } else {
            this.calculate_stake();
        }
        bookmaker_rates[$(el).data('bookmaker_id')] = $(el).val();
        return false;
    },

    change_koef_lay: function (e) {
        var el, id, koef_back;
        el = e.target;
        if (e.keyCode === 188 || e.keyCode === 110) {
            $(el).val($(el).val().replace(/,/, '.'));
        }
        id = $(el).attr('id').replace(/\D/g, '');
        koef_back = (1 + 1 / (parseFloat($(el).val()) - 1)).toFixed(3);
        $("#outcome" + id + "_koef").val(koef_back).change();
        this.reload_formula();
        return false;
    },

    change_rate: function (e) {
        var el;
        el = e.target;
        $(el).siblings("input[type='hidden']").val(this.rates[$(el).val()]);
        /*$.post("/arbs/bookmaker_rate/", {
         bookmaker_id: $(el).data('bookmaker_id'),
         currency_id: $(el).val()
         });*/
        this.calculate();
        return false;
    },

    change_round_stake: function (e) {
        // TODO:
        return false;
        var el;
        el = e.target;
        return $.post("/arbs/round_stake/", {
            round_stake: $(el).val()
        });
    },

    click_calculate: function (e) {
        return this.calculate();
    },

    click_exclude_event: function (e) {
        var el, id, url;
        if (!App.current_user) {
            this.user_sign_in();
            console.log("uncomment this");
            //return false;
        }
        el = e.target;
        id = $(el).attr("event");
        url = App.host + "/api/v3/events/" + id + "/exclude_arbs?api_token=" + App.api_token + "&access_token=" + App.access_token;
        console.log(url);
        /*$.post(url, {
         _method: "delete"
         }, function(data) {
         return $(el).slideUp();
         });*/
        return false;
    },

    exclude_bet: function (e) {
        var el, id, url;
        if (!App.current_user) {
            this.user_sign_in();
            console.log("uncomment this");
            //return false;
        }
        el = $(e.currentTarget);
        id = el.attr("bet");
        url = App.host + "/api/v3/bets/" + id + "/exclude_arbs?api_token=" + App.api_token + "&access_token=" + App.access_token;
        console.log(url);
        /*$.post(url, {
         _method: "delete"
         }, function(data) {
         $(".bet_" + data.id).slideUp(function() {
         return App.filter.refresh();
         });
         return el.slideUp();
         });*/
        return false;
    },

    user_sign_in: function () {
        console.log("redirect to sign in page");
        // TODO: поставьте свой путь на логин-страницу
        //window.location = '/users/sign_in';
        //return false;

    },

    fix_comma: function () {
        return $("input.koef, input.stake, input.koef_lay, inlut.stake_lay").each(function (i) {
            return $(this).val($(this).val().replace(/,/, '.'));
        });
    },

    round: function (b, pos) {
        var a, d, min_round, round_div, s;
        round_div = pos == null ? "#round_stake" : "#outcome" + pos + "_round";
        a = parseFloat($(round_div).val());
        if (!(a > 0)) {
            a = parseFloat($("#round_stake").val());
        }
        min_round = a;
        if (pos == null) {
            _([1, 2, 3]).each(function (i) {
                var stake_round;
                stake_round = parseFloat($("#outcome" + i + "_round").val());
                if (stake_round > 0 && stake_round < min_round) {
                    return min_round = stake_round;
                }
            });
        }
        a = min_round;
        s = a.toString();
        if (s.lastIndexOf('.') > -1) {
            d = s.length - s.lastIndexOf('.') - 1;
        } else {
            d = 0;
        }
        return (isNaN(a) || a === 0 ? Math.round(b) : Math.round(b / a) * a).toFixed(d);
    },

    calculate_total: function () {
        var total;
        total = $("#outcome1_stake").val() / $("#outcome1_rate").val() + $("#outcome2_stake").val() / $("#outcome2_rate").val();
        if ($("#outcome3_stake").val()) {
            total = total + $("#outcome3_stake").val() / $("#outcome3_rate").val();
        }
        if (total > 0.0) {
            $("#total_stake").val(this.round(total * $("#total_rate").val()));
        }
        return total;
    },

    calculate_stake: function () {
        var koef1, koef2, koef3, rate1, rate2, rate3, total, _total;
        total = this.calculate_total();
        rate1 = $("#outcome1_rate").val();
        rate2 = $("#outcome2_rate").val();
        rate3 = $("#outcome3_rate").val();
        koef1 = App.Formulas.koef_kommissed($("#outcome1_koef").val(), $("#outcome1_commission").val());
        koef2 = App.Formulas.koef_kommissed($("#outcome2_koef").val(), $("#outcome2_commission").val());
        koef3 = App.Formulas.koef_kommissed($("#outcome3_koef").val(), $("#outcome3_commission").val());
        $("[id^='revenue']").removeClass('negative');
        _total = $("#total_stake").val() / $("#total_rate").val();
        this.calculate_revenue(koef1, koef2, koef3, rate1, rate2, rate3, _total);
        if (koef1 * $("#outcome1_stake").val() < _total) {
            $("#revenue1").addClass('negative');
        }
        if (koef2 * $("#outcome2_stake").val() < _total) {
            $("#revenue2").addClass('negative');
        }
        if (koef3 * $("#outcome3_stake").val() < _total) {
            $("#revenue3").addClass('negative');
        }
        $("#copy_button").attr('data-clipboard-text', this.text_to_copy());
        $('#outcome1_copy').attr('data-clipboard-text', $("#outcome1_stake").val());
        $('#outcome2_copy').attr('data-clipboard-text', $("#outcome2_stake").val());
        return $('#outcome3_copy').attr('data-clipboard-text', $("#outcome3_stake").val());
    },

    calculate_revenue: function (koef1, koef2, koef3, rate1, rate2, rate3, _total) {
        var stake1, stake2, stake3;
        koef1 = parseFloat(koef1);
        koef2 = parseFloat(koef2);
        koef3 = parseFloat(koef3);
        stake1 = $("#outcome1_stake").val() / rate1;
        stake2 = $("#outcome2_stake").val() / rate2;
        stake3 = $("#outcome3_stake").val() / rate3;

        // matchbook commission on lose
        var i, lose, matchbook_index, _i, _len, _ref;
        lose = null;
        matchbook_index = 0;

        _ref = [1, 2, 3];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            i = _ref[_i];
            console.log($("tr[outcome=" + i + "] td.bookmaker select option:selected").attr('bookmaker_id'));
            if ($("tr[outcome=" + i + "] td.bookmaker select option:selected").attr('bookmaker_id') == '31') {
                matchbook_index = i;
                lose = $("#outcome" + i + "_stake").val() / $("#outcome" + i + "_rate").val() * 0.01;
            }
        }

        outcome1 = this.calc_formula.revenue_1(koef1, stake1, koef2, stake2, koef3, stake3, _total) * rate1
        outcome2 = this.calc_formula.revenue_2(koef1, stake1, koef2, stake2, koef3, stake3, _total) * rate2
        if (this.calc_formula.revenue_3) {
            outcome3 = this.calc_formula.revenue_3(koef1, stake1, koef2, stake2, koef3, stake3, _total) * rate3
        }

        // matchbook commission on lose
        if (lose && matchbook_index != 1) {
            outcome1 = outcome1 - lose * rate1
        }
        if (lose && matchbook_index != 2) {
            outcome2 = outcome2 - lose * rate2
        }
        if (this.calc_formula.revenue_3 && lose && matchbook_index != 3) {
            outcome3 = outcome3 - lose * rate3
        }

        $("#revenue1").html(outcome1.toFixed(2));
        $("#revenue2").html(outcome2.toFixed(2));
        if (this.calc_formula.revenue_3) {
            return $("#revenue3").html(outcome3.toFixed(2));
        }
    },


    outcome_round: function (p) {
        var a;
        a = parseFloat($("#outcome" + p + "_round").val());
        if (!(a > 0)) {
            a = parseFloat($("#round_stake").val());
        }
        return a;
    },

    fix_round_stake: function () {
        var min_round_outcome, rounds;
        min_round_outcome = 1;
        rounds = [this.outcome_round(1), this.outcome_round(2)];
        if (this.model.outcome3 != null) {
            rounds[2] = this.outcome_round(3);
        }
        if (rounds[1] < rounds[0]) {
            min_round_outcome = 2;
        }
        if (rounds[2] < rounds[1] && rounds[2] < rounds[0]) {
            min_round_outcome = 3;
        }
        return min_round_outcome;
    },

    calculate: function (skip_total_recalculate) {
        var fix_rate, fix_stake, fixed_stake, koef1, koef2, koef3, outcome1, outcome1_full, outcome2, outcome2_full, outcome3, outcome3_full, percent, rate1, rate2, rate3, rounded_outcome1, rounded_outcome2, rounded_outcome3, stake_lay, total, total_full, _total;
        if (skip_total_recalculate == null) {
            skip_total_recalculate = false;
        }
        fixed_stake = $("input[name=stake_fix]:checked").val();
        if (fixed_stake === 'total') {
            total = $("#total_stake").val() / $("#total_rate").val();
        } else {
            total = $("#outcome" + fixed_stake + "_stake").val() / ($("#outcome" + fixed_stake + "_rate").val() * $("#outcome" + fixed_stake + "_stake_percent").val());
            console.log($("#outcome" + fixed_stake + "_stake").val() + "; " + $("#outcome" + fixed_stake + "_rate").val() + "; " + $("#outcome" + fixed_stake + "_stake_percent").val());
            $("#total_stake").val(this.round(total * $("#total_rate").val()));
        }
        outcome1 = $("#outcome1_stake_percent").val() * total;
        outcome2 = $("#outcome2_stake_percent").val() * total;
        outcome3 = this.model.outcome3 != null ? $("#outcome3_stake_percent").val() * total : 0.0;
        percent = $("#percent").val();
        rate1 = $("#outcome1_rate").val();
        rate2 = $("#outcome2_rate").val();
        rate3 = $("#outcome3_rate").val();
        rounded_outcome1 = this.round(outcome1 * rate1, 1);
        rounded_outcome2 = this.round(outcome2 * rate2, 2);
        rounded_outcome3 = this.model.outcome3 != null ? this.round(outcome3 * rate3, 3) : 0.0;
        fix_stake = this.fix_round_stake();
        fix_rate = $("#outcome" + fix_stake + "_rate").val();
        total_full = this.round(total * fix_rate);
        outcome1_full = this.round(outcome1 * fix_rate, 1);
        outcome2_full = this.round(outcome2 * fix_rate, 2);
        outcome3_full = this.round(outcome3 * fix_rate, 3);
        if (fix_stake === 1) {
            rounded_outcome1 = this.round(total_full - outcome2_full - outcome3_full, 1);
        } else if (fix_stake === 2) {
            rounded_outcome2 = this.round(total_full - outcome1_full - outcome3_full, 2);
        } else if (fix_stake === 3 && (this.model.outcome3 != null)) {
            rounded_outcome3 = this.round(total_full - outcome1_full - outcome2_full, 3);
        }
        $("#outcome1_stake").val(rounded_outcome1);
        stake_lay = this.round((parseFloat($("#outcome1_koef").val()) - 1) * $("#outcome1_stake").val(), 1);
        $("#outcome1_stake_lay").val(stake_lay);
        $("#outcome2_stake").val(rounded_outcome2);
        stake_lay = this.round((parseFloat($("#outcome2_koef").val()) - 1) * $("#outcome2_stake").val(), 2);
        $("#outcome2_stake_lay").val(stake_lay);
        $("#outcome3_stake").val(rounded_outcome3);
        stake_lay = this.round((parseFloat($("#outcome3_koef").val()) - 1) * $("#outcome3_stake").val(), 3);
        $("#outcome3_stake_lay").val(stake_lay);
        koef1 = App.Formulas.koef_kommissed($("#outcome1_koef").val(), $("#outcome1_commission").val());
        koef2 = App.Formulas.koef_kommissed($("#outcome2_koef").val(), $("#outcome2_commission").val());
        koef3 = App.Formulas.koef_kommissed($("#outcome3_koef").val(), $("#outcome3_commission").val());
        $("#outcome1_koef_static").html(koef1);
        $("#outcome2_koef_static").html(koef2);
        $("#outcome3_koef_static").html(koef3);
        $("[id^='revenue']").removeClass('negative');
        _total = $("#total_stake").val() / $("#total_rate").val();
        this.calculate_revenue(koef1, koef2, koef3, rate1, rate2, rate3, _total);
        if (koef1 * outcome1 < _total) {
            $("#revenue1").addClass('negative');
        }
        if (koef2 * outcome2 < _total) {
            $("#revenue2").addClass('negative');
        }
        if (koef3 * outcome3 < _total) {
            $("#revenue3").addClass('negative');
        }
        $("#copy_button").attr('data-clipboard-text', this.text_to_copy());
        $('#outcome1_copy').attr('data-clipboard-text', $("#outcome1_stake").val());
        $('#outcome2_copy').attr('data-clipboard-text', $("#outcome2_stake").val());
        return $('#outcome3_copy').attr('data-clipboard-text', $("#outcome3_stake").val());
    },

    reload_formula: function () {
        var data, formula, koef1, koef2, koef3;
        koef1 = App.Formulas.koef_kommissed($("#outcome1_koef").val(), $("#outcome1_commission").val());
        koef2 = App.Formulas.koef_kommissed($("#outcome2_koef").val(), $("#outcome2_commission").val());
        koef3 = App.Formulas.koef_kommissed($("#outcome3_koef").val(), $("#outcome3_commission").val());
        formula = $("#formula").val();
        this.calc_formula = this.get_calc_formula(parseInt(formula));
        if (formula.search("r") > 0 && parseFloat(koef3) > 0) {
            data = this.get_formula(parseInt(formula))(koef3, koef2, koef1);
        } else {
            data = this.get_formula(parseInt(formula))(koef1, koef2, koef3);
        }

        $("#outcome1_stake_percent").val(data.calc.stakes[0]);
        $("#outcome2_stake_percent").val(data.calc.stakes[1]);
        $("#outcome3_stake_percent").val(data.calc.stakes[2]);
        $("#percent").val(data.calc.percent);
        $("#percent_display").html(data.calc.percent + " %");
        this.calculate();
        return false;
    },

    text_to_copy: function () {
        var bookmaker, date, i, line, lines, revenue, text, title, _fn, _i, _len;
        date = $("span.utc_withyear").text().replace(/^\s+|\s+$/g, '');
        title = $("span.title").text().replace(/^\s+|\s+$/g, '') + " (" + $(".head h2 small").text().replace(/^\s+|\s+$/g, '') + ")";
        lines = [];
        i = 1;
        while (!isNaN($("#outcome" + i + "_koef").val())) {
            if ($("tr[outcome=" + i + "] td.bookmaker select option:selected").text()) {
                bookmaker = $("tr[outcome=" + i + "] td.bookmaker select option:selected").text().replace(/\:\s[\d\.]+\s\(\d+\)$/, '').replace(/^\s+|\s+$/g, '');
            } else {
                bookmaker = $("tr[outcome=" + i + "] td.bookmaker").text().replace(/^\s+|\s+$/g, '');
            }
            revenue = $("#revenue" + i).text();
            lines.push({
                bookmaker: bookmaker,
                outcome: $("tr[outcome=" + i + "] td.outcome").text().replace(/^\s+|\s+$/g, ''),
                stake: $("#outcome" + i + "_stake").val(),
                currency: $("#outcome" + i + "_currency option:selected").html(),
                revenue: revenue,
                koef: App.Formulas.koef_kommissed($("#outcome" + i + "_koef").val(), $("#outcome" + i + "_commission").val())
            });
            i++;
        }
        text = date + "\t" + title + "\r\n";
        _fn = function (line) {
            return text = text + line.bookmaker + "\t" + line.outcome + "\t" + line.koef + "\t" + line.stake + "\t" + line.currency + "\t" + line.revenue + "\r\n";
        };
        for (_i = 0, _len = lines.length; _i < _len; _i++) {
            line = lines[_i];
            _fn(line);
        }
        return text;
    },

    click_same_bets_refresh: function (e) {
        var el, path, sel,
            _this = this;
        el = e.target;
        sel = $(el).parent().prev().find("select");
        if (sel.attr('id')) {
            path = App.host + "/api/v1/bets/" + (sel.attr('id')) + "/same-pro" + (this.options.is_live ? '_live' : '') + "?access_token=" + this.options.access_token;
            return $.get(path).done(function (data) {
                return _this.same_bets_load(data, sel);
            });
        }
    },

    same_bets_load: function (data, sel) {
        var bet, selected_option, _fn, _i, _len;
        selected_option = parseInt(sel.val());
        if (!(data.length > 0)) {
            return;
        }
        sel.empty();
        _fn = function (bet) {
            var bookmaker, option;
            bookmaker = App.bookmakers.get(bet.bookmaker_id);
            option = $("<option></option>").attr("value", bet.id).attr("bc_id", bet.bc_id).attr('bookmaker_id', bet.bookmaker_id).attr('bookmaker_event_name', bet.bookmaker_event_name).attr('bookmaker_league_name', bet.bookmaker_league_name).attr('koef', bet.koef).attr('commission', bet.commission).text(bookmaker.get('name') + ': ' + bet.koef + ' (' + bet.arbs + ')');
            if (bet.id === selected_option) {
                option.attr('selected', 'selected');
            }
            return sel.append(option);
        };
        for (_i = 0, _len = data.length; _i < _len; _i++) {
            bet = data[_i];
            _fn(bet);
        }
        return sel.change();
    },


    change_same_bets: function (e) {
        var bc, bc_id, bookmaker_id, el, i, koef_lay, opt, td, tr, val, _i, _len, _ref1;
        el = e.target;
        opt = $(el).find(":selected");
        bc_id = opt.attr('bc_id');
        bc = App.bet_combinations.get(bc_id);
        td = $(el).parent('td').prev();
        tr = $(td).parent();
        td.find('a').attr('href', '/bets/' + opt.val()).text(bc.display_original_value());
        $("#outcome" + $(el).attr('number') + "_koef").val(opt.attr('koef')).change();
        koef_lay = (1 + 1 / (parseFloat(opt.attr('koef')) - 1)).toFixed(3);
        $("#outcome" + $(el).attr('number') + "_koef_lay").val(koef_lay);
        bookmaker_id = opt.attr('bookmaker_id');
        tr.find('.exclude_bet').attr('bet', opt.val());
//        if (this.bookmaker_rates[bookmaker_id]) {
//            $("#outcome" + $(el).attr("number") + "_currency").data("bookmaker_id", bookmaker_id);
//            $("#outcome" + $(el).attr("number") + "_currency").val(bookmaker_rates[bookmaker_id]);
//            $("#outcome" + $(el).attr("number") + "_rate").val(rates[bookmaker_rates[bookmaker_id]]);
//        }
//        if (this.bookmaker_commissions[bookmaker_id]) {
//            $("#outcome" + $(el).attr("number") + "_commission").val(bookmaker_commissions[bookmaker_id]);
//        } else {
            $("#outcome" + $(el).attr("number") + "_commission").val(opt.attr('commission'));
//        }
        if (this.bookmaker_amounts[bookmaker_id] && parseFloat(this.bookmaker_amounts[bookmaker_id]) > 0) {
            $("#outcome" + $(el).attr("number") + "_stake_fix").attr("checked", "checked");
            $("#outcome" + $(el).attr("number") + "_stake").val(this.bookmaker_amounts[bookmaker_id]).change();
            this.bookmaker_amounts[0] = '';
            this.calculate();
        }
        _ref1 = [1, 2, 3];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            i = _ref1[_i];
            val = $("#outcome" + i + "_stake").val();
            bookmaker_id = $("#outcome" + i + "_currency").data("bookmaker_id");
            if (this.bookmaker_amounts[bookmaker_id] && parseFloat(this.bookmaker_amounts[bookmaker_id]) > 0 && parseFloat(this.bookmaker_amounts[bookmaker_id]) < val) {
                $("#outcome" + i + "_stake_fix").attr("checked", "checked");
                $("#outcome" + i + "_stake").val(this.bookmaker_amounts[bookmaker_id]);
                this.calculate();
            }
        }
        if (this.bookmaker_amounts['0'] && parseFloat(this.bookmaker_amounts['0']) > 0 && parseFloat(this.bookmaker_amounts['0']) < $("#total_stake").val()) {
            $("#total_stake_fix").attr("checked", "checked");
            $("#total_stake").val(this.bookmaker_amounts['0']).change();
            this.calculate();
        }
        return this.reload_formula();
    },

    change_distr: function (e) {
        return this.reload_formula();
    }
});


