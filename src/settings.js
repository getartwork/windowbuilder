/**
 * настройки отладчика рисовалки paperjs
 */

/**
 * Алиасы глобальных свойств
 */
var acn,

/**
 * Константы и параметры
 */
	consts = new function Settings(){

	/**
	 * Прилипание. На этом расстоянии узел пытается прилепиться к другому узлу или элементу
	 * @property sticking
	 * @type {number}
	 */
	this.sticking = 80;
	this.sticking2 = this.sticking * this.sticking;

	this.lgray = new paper.Color(0.96, 0.98, 0.94, 0.96);

	/**
	 * Размер визуализации узла пути
	 * @property handleSize
	 * @type {number}
	 */
	paper.settings.handleSize = 8;

	this.move_points = 'move_points';
	this.move_handle = 'move_handle';

};