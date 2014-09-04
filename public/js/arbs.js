$.fn.serializeObject = function () {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function () {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

ArbItemView = Backbone.View.extend({
    tag: 'li',
    template: _.template($('#arb-template').html()),
    item_template: _.template($('#outcome-template').html()),

    render: function () {
        this.$el.html(this.template({
            arb: this.model,
            params: this.options.params,
            item_template: this.item_template
        }));
        return this;
    }
});

ArbView = Backbone.View.extend({
    report_template: _.template($('#report-template').html()),
    wrong_items_template: _.template($('#wrong-items-template').html()),
    el: $('#arbs'),

    events: {
        "click .report_arb": "report_arb",
        "click .exclude_arb": "exclude_arb",
        "click .exclude_event": "exclude_event",
        "click .exclude_bet": "exclude_bet",
        "click .calculator_link": "show_calculator",
        "click .wrong-items": "show_wrong_items"
    },

    show_wrong_items: function (e) {
        var id, url;
        var _this = this;

        if (!App.current_user) {
            this.sign_in_user();
            return;
        }

        id = $(e.target).data().arb;
        var arb = App.arbs.get(id);
        if (!arb) {
            return false;
        }

        arb.fetch_wrong_items(function (items) {
            $("#WrongItems .modal-body").html(_this.wrong_items_template({items: items}));
            $("#WrongItems").modal('toggle');
        });

        return false;
    },

    report_arb: function (e) {
        var arb = App.arbs.get($(e.target).parent().data().arb);
        if (!arb) {
            return false;
        }

        $("#ReportArb .modal-body").html(this.report_template({arb: arb}));
        $("#ReportArb").modal('toggle');

        return true;
    },

    exclude_arb: function (e) {
        var id;
        if (!App.current_user) {
            this.sign_in_user();
            // TODO: разкоментируйте чтобы только залогиненые юзера могли использовать метод
            //return false;
        }
        id = $(e.currentTarget).attr("arb");
        App.arbs.get(id).destroy();
        filter.refresh();
        return false;
    },

    exclude_bet: function (e) {
        var id;
        if (!App.current_user) {
            this.sign_in_user();
            // TODO: разкоментируйте чтобы только залогиненые юзера могли использовать метод
            //return false;
        }
        id = $(e.currentTarget).attr("bet");
        App.bets.get(id).destroy();
        filter.refresh();
        return false;
    },

    exclude_event: function (e) {
        var id, url;
        if (!App.current_user) {
            this.sign_in_user();
            // TODO: разкоментируйте чтобы только залогиненые юзера могли использовать метод
            //return false;
        }
        id = $(e.currentTarget).attr("event");
        url = App.host + "/api/v3/events/" + id + "/exclude_arbs?api_token=" + App.api_token + "&access_token=" + App.access_token;
        console.log(url)
        /*
         * delete url
         * $.post(url, {
         _method: "delete"
         }, function(data) {
         return $(".event_" + data.id).slideUp(function() {
         return filter.refresh();
         });
         });
         */
        return false;
    },

    sign_in_user: function () {
        console.log("redirect to login page");
        //return window.location = '/users/sign_in';
    },


    render: function () {
        _this = this;
        fragment = document.createDocumentFragment();

        App.arbs.each(function (arb) {
            if ((arb.bet1() == null) || (arb.bet2() == null)) {
                return;
            }
            if ((arb.get('bet3_id') != null) && (arb.bet3() == null)) {
                return;
            }
            fragment.appendChild(new ArbItemView({model: arb, params: _this.options.params}).render().el);
        });

        this.$el.empty();
        this.$el.append(fragment);

        $(".utc[data-utc]").each(function () {
            //$(this).html($.format.date($(this).data('utc'), "dd-MM HH:mm"));
            $(this).html($.format.date(parseInt(this.innerHTML), "dd-MM HH:mm"));
        });

        $(".utc_withyear[data-utc]").each(function () {
            //$(this).html($.format.date($(this).data('utc'), "dd-MM-yyyy HH:mm"));
            $(this).html($.format.date(parseInt(this.innerHTML), "dd-MM-yyyy HH:mm"));
        });

        return this;
    },

    calculator_url: function (arb) {
        var arb_data, bets, data;
        if (arb == null) {
            return false;
        }
        bets = [arb.bet1().toJSON(), arb.bet2().toJSON()];
        if (arb.get('bet3_id') != null) {
            bets[2] = arb.bet3().toJSON();
        }
        data = {
            arb: arb.toJSON(),
            bets: bets
        };
        arb_data = JSON.stringify(data);
        return "calculator.html#" + arb_data;
    },

    show_calculator: function (e) {
        var el = $(e.currentTarget);
        arb = App.arbs.get(el.data().arb);
        if ((arb == null) || (arb.bet1().bet_combination() == null)) {
            return false;
        }
        this.simplepopup(this.calculator_url(arb), 1135, 340);
        return false;
    },

    simplepopup: function (url, width, height) {
        var winl = 20;
        var wint = 20;
        var settings = "left=" + winl + ",top=" + wint + ",width=" + (width + 40) + ",height=" + (height + 40) + ",toolbar=no,menubar=no,status=yes,scrollbars=yes,resizable=no";
        var wnd = window.open(url, "_blank", settings);
        wnd.focus();
        return wnd;
    }
});

ListView = Backbone.View.extend({
    template: _.template($('#list-item-template').html()),

    render: function () {
        list = this.template({items: this.model, name: this.options.name});
        this.$el.append(list);

        return this;
    }
});

ReportMail = Backbone.View.extend({
    template: _.template($('#report-email-template').html()),
    outcome_template: _.template($('#outcome-email-template').html()),

    render: function () {
        var sport = App.sports.get(this.model.get('sport_id'));
        return this.template({    arb: this.model,
            sport: sport,
            render_outcome: this.outcome_template,
            user_email: App.current_user,
            reason: this.options.reason
        });
    }
});

FilterView = Backbone.View.extend({
    template: _.template($('#leftside-template').html()),
    header_template: _.template($('#header-template').html()),

    grouped: true,
    event_id: null,

    events: {
        "submit": "refresh",
        "click .apply-button": "apply",
        "click .check-all": "check_all",
        "change #grouped": "grouped_change",
        "click .submit-report": "send_arb_report",
        "change #notification_popup": "request_permission"
    },

    initialize: function () {
        this.options.params = {access_token: $("#access_token").val() || ""};
        App.stats = {};
        this.render();

        (new ListView({el: $("#bookmakers_1"), model: App.bookmakers, name: 'bookmakers1'})).render();
        (new ListView({el: $("#bookmakers_2"), model: App.bookmakers, name: 'bookmakers2'})).render();
        (new ListView({el: $("#sports"), model: App.sports, name: 'sports'})).render();

        this.arb_view = new ArbView();

        $(document).on('click', "#sort_by_tab button", this.sort_by);
        $(document).on('click', "#cancel-grouping", this.cancel_grouping);
    },

    send_arb_report: function () {
        var reason;
        id = $("#arb-report-form input[name='id']").val();
        options = $("#arb-report-form").serializeObject();
        arb = App.arbs.get(id);

        if (options.own_reason) {
            reason = options.own_reason;
        } else {
            if (/\([\d\.\-\+]+\)/.test(options.reason)) {
                reason = options.reason;
            } else if (/\|/.test(options.reason)) {
                info = options.reason.split('|');
                bet = App.bets.get(info[1]);
                reason = _(I18n.t("wrong_arb." + info[0])).sprintf(bet.bookmaker().get('name'), bet.display_original_value(false));
            } else {
                reason = I18n.t("wrong_arb." + options.reason);
            }
        }

        mail = new ReportMail({model: arb, reason: reason});
        arb.destroy({'report': mail.render(), 'reason': options.own_reason || options.reason});

        this.refresh();
    },

    apply: function () {
        this.refresh();
        return true;
    },

    cancel_grouping: function () {
        $("#event_id")[0].value = null;
        filter.event_id = null;
        filter.refresh();
    },

    sort_by: function (e) {
        $("#sort_by")[0].value = $(e.target).data("value");
        filter.refresh();
    },

    event_arbs: function (e) {
        filter.event_id = $(e.currentTarget).data("event-id");
        $("#event_id")[0].value = filter.event_id;
        filter.refresh();
    },

    render: function () {
        this.$el.append(this.template());
        $('#header').append(this.header_template({params: this.options.params}));
        return this;
    },

    refresh: function () {
        _this = this;
        event_arbs_func = this.event_arbs;

        // TODO: refactor
        data = $("#filter-form").serialize();
        data += "&access_token=" + App.access_token;
        if (this.grouped == true && !this.event_id) {
            data = data + "&grouped=true"
        }

        this.load_stats();
        $("input#date_shift").val(this.date_shift());

        old_arbs = App.arbs.clone();

        App.arbs.fetch({data: data, type: 'POST', success: function (collection, response) {
            var diff;
            diff = _.difference(App.arbs.map(function (a) {
                return a.get('arb_hash');
            }), old_arbs.map(function (a) {
                return a.get('arb_hash');
            }));
            if (old_arbs.length > 0 && diff.length > 0) {
                if ($("#notification_sound[type='checkbox']").prop("checked")) {
                    App.playSound();
                }
                if ($("#notification_popup[type='checkbox']").prop("checked")) {
                    var arb=App.arbs.findWhere({arb_hash:diff[0]});
                    var notif = arb.to_notification();
                    desktop_notif(_this.arb_view.calculator_url(arb), notif.title, notif.text);
                }
            }

            App.stats = {
                max_percent: response.max_percent_by_filter,
                total: response.total_by_filter
            };
            $('#total_count').text(response.total);
            $('#max_percent').text(_("%.1f").sprintf(response.max_percent || 0) + '%');
            $('#last_update').text(I18n.t('arb.Updated') + " " + (new Date(response.last_update * 1000)).toLocaleString() + " (" + $.timeago(response.last_update * 1000) + ")");
            _this.load_stats();

            if (_this.arb_view) {
                _this.arb_view.options.params = _this.options.params;
                _this.arb_view.render();
            }

            if (filter.grouped) {
                $('.show-event-arbs').bind('click', event_arbs_func);
            }
            if (filter.grouped && filter.event_id) {
                $("#cancel-grouping").show();
            } else {
                $("#cancel-grouping").hide();
            }
        }});


        return false;
    },
    date_shift: function () {
        res = 0;

        if (!isNaN(parseInt($("#till_days").val()))) {
            res += parseInt($("#till_days").val()) * 24 * 60;
        }
        if (!isNaN(parseInt($("#till_hours").val()))) {
            res += parseInt($("#till_hours").val()) * 60;
        }
        if (!isNaN(parseInt($("#till_minutes").val()))) {
            res += parseInt($("#till_minutes").val());
        }

        return res;
    },

    grouped_change: function (e) {
        this.grouped = e.target.checked;
        if (!this.grouped) {
            $("#event_id")[0].value = null;
            this.event_id = null;
        }

        $('#header').html(this.header_template({params: this.options.params}));

        filter.refresh();
    },

    check_all: function (e) {
        container_id = $(e.target).parent().parent()[0].id;
        $("#" + container_id + " input[type='checkbox']").attr("checked", e.target.checked);
    },

    load_stats: function () {
        $("#stats_count").text(App.stats.total);
        $("#stats_percent").text(_("%.1f").sprintf(App.stats.max_percent || 0) + '%');
    },

    request_permission: function() {
        RequestPermission();
    }
});


var filter;

$.ajax(App.host + '/api/v1/directories?access_token=' + App.access_token).done(function (response, status_code) {
    App.sports.reset(response.sports);
    App.bookmakers.reset(response.bookmakers);
    App.periods.reset(response.periods);
    App.sport_periods.reset(response.sport_periods);
    App.bet_variations.reset(response.bet_variations);
    App.bet_combinations.reset(response.bet_combinations);
    App.bet_values.reset(response.bet_values);
    App.markets.reset(response.markets);
    App.market_variations.reset(response.market_variations);

    filter = new FilterView({el: $('#filters')});
    filter.refresh();

    setInterval(function () {
        if ($("#auto_update").attr('checked')) {
            filter.refresh();
        }
    }, 10000);
});
