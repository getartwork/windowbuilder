/**
 * ### Дополнительные методы справочника Цвета
 * 
 * &copy; Evgeniy Malyarov http://www.oknosoft.ru 2014-2016
 * @module cat_cnns
 * Created 23.12.2015
 */

$p.cat.clrs.__define({

	/**
	 * ПолучитьЦветПоПредопределенномуЦвету
	 * @param clr
	 * @param clr_elm
	 * @param clr_sch
	 * @return {*}
	 */
	by_predefined: {
		value: function(clr, clr_elm, clr_sch){
			if(clr.predefined_name){
				return clr_elm;
			}else if(clr.empty())
				return clr_elm;
			else
				return clr;
		}
	},

	/**
	 * Дополняет связи параметров выбора отбором, исключающим служебные цвета
	 * @param mf {Object} - описание метаданных поля
	 */
	selection_exclude_service: {
		value: function (mf, sys) {

			if(mf.choice_params)
				mf.choice_params.length = 0;
			else
				mf.choice_params = [];

			mf.choice_params.push({
				name: "parent",
				path: {not: $p.cat.clrs.predefined("СЛУЖЕБНЫЕ")}
			});

			if(sys){
				mf.choice_params.push({
					name: "ref",
					get path(){

						var clr_group, elm, res = [];

						if(sys instanceof $p.Editor.BuilderElement){
							clr_group = sys.inset.clr_group;
							if(clr_group.empty() && !(sys instanceof $p.Editor.Filling))
								clr_group = sys.project._dp.sys.clr_group;

						}else if(sys instanceof $p.DataProcessorObj){
							clr_group = sys.sys.clr_group;

						}else{
							clr_group = sys.clr_group;

						}

						if(clr_group.empty() || !clr_group.clr_conformity.count()){
							$p.cat.clrs.alatable.forEach(function (row) {
								if(!row.is_folder)
									res.push(row.ref);
							})
						}else{
							$p.cat.clrs.alatable.forEach(function (row) {
								if(!row.is_folder){
									if(clr_group.clr_conformity._obj.some(function (cg) {
											return row.parent == cg.clr1 || row.ref == cg.clr1;
										}))
										res.push(row.ref);
								}
							})
						}
						return {in: res};
					}
				});
			}


		}
	},

	/**
	 * Форма выбора с фильтром по двум цветам, создающая при необходимости составной цвет
	 */
	form_selection: {
		value: function (pwnd, attr) {

			attr.hide_filter = true;

			var wnd = this.constructor.prototype.form_selection.call(this, pwnd, attr),
				eclr = this.get($p.utils.blank.guid, false, true);

			function get_option_list(val, selection) {

				selection.clr_in = $p.utils.blank.guid;
				selection.clr_out = $p.utils.blank.guid;

				if(attr.selection){
					attr.selection.some(function (sel) {
						for(var key in sel){
							if(key == "ref"){
								selection.ref = sel.ref;
								return true;
							}
						}
					});
				}
				
				return this.constructor.prototype.get_option_list.call(this, val, selection);
			}

			return (wnd instanceof Promise ? wnd : Promise.resolve(wnd))
				.then(function (wnd) {

					var tb_filter = wnd.elmnts.filter;

					tb_filter.__define({
						get_filter: {
							value: function () {
								var res = {
									selection: []
								};
								if(clr_in.getSelectedValue())
									res.selection.push({clr_in: clr_in.getSelectedValue()});
								if(clr_out.getSelectedValue())
									res.selection.push({clr_out: clr_out.getSelectedValue()});
								if(res.selection.length)
									res.hide_tree = true;
								return res;
							}
						}
					});

					wnd.attachEvent("onClose", function(){

						clr_in.unload();
						clr_out.unload();

						eclr.clr_in = $p.utils.blank.guid;
						eclr.clr_out = $p.utils.blank.guid;

						return true;
					});

					Object.unobserve(eclr);

					eclr.clr_in = $p.utils.blank.guid;
					eclr.clr_out = $p.utils.blank.guid;

					// Создаём элементы управления
					var clr_in = new $p.iface.OCombo({
						parent: tb_filter.div.obj,
						obj: eclr,
						field: "clr_in",
						width: 150,
						hide_frm: true,
						get_option_list: get_option_list
					}), clr_out = new $p.iface.OCombo({
						parent: tb_filter.div.obj,
						obj: eclr,
						field: "clr_out",
						width: 150,
						hide_frm: true,
						get_option_list: get_option_list
					});

					clr_in.DOMelem.style.float = "left";
					clr_in.DOMelem_input.placeholder = "Цвет изнутри";
					clr_out.DOMelem_input.placeholder = "Цвет снаружи";

					clr_in.attachEvent("onChange", tb_filter.call_event);
					clr_out.attachEvent("onChange", tb_filter.call_event);
					clr_in.attachEvent("onClose", tb_filter.call_event);
					clr_out.attachEvent("onClose", tb_filter.call_event);

					return wnd;

				})
		}
	},

	/**
	 * Изменяем алгоритм построения формы списка. Игнорируем иерархию, если указаны цвета изнутри или снаружи
	 */
	sync_grid: {
		value: function(attr, grid) {

			if(attr.action == "get_selection" && attr.selection && attr.selection.some(function (v) {
				return v.hasOwnProperty("clr_in") || v.hasOwnProperty("clr_out");
				})){
				delete attr.parent;
				delete attr.initial_value;
			}

			return $p.DataManager.prototype.sync_grid.call(this, attr, grid);
		}
	}
});

