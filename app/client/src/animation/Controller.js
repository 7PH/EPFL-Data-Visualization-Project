import {Preload} from "../preloader/Preload";
import {Model} from "./Model";
import {View} from "./View";
import {scale} from "../util/maths";
const Helpers = require("../../../data-extraction/Helpers");


export class Controller {

    constructor() {

        this.model = new Model();
        this.view = new View(this.model);

        this.autoplay = true;
    }

    /**
     * Preload all deps and init the web app
     *
     * @return {Promise<void>}
     */
    async init() {

        await Preload.run();

        this.bindedHandler = this.start.bind(this);
        document.getElementById("page-intro").addEventListener("click", this.bindedHandler);

        this.bind();
    }

    /**
     * Go to content
     *
     * @return {Promise<void>}
     */
    async start() {

        document.getElementById("page-intro").removeEventListener("click", this.bindedHandler);

        setTimeout(() => {
            document.getElementById('page-intro').classList.add('hidden');
        }, 6 * 1000);

        document.getElementById("page-intro").style.opacity = "0";
        document.getElementById("page-content").classList.remove("hidden");

        await this.view.start();

        if (this.autoplay)
            setTimeout(() => this.playTimeline(), Controller.TIMELINE_SPEED);

        document.getElementById('ambient-audio').play();
    }

    /**
     *
     * @return {Promise<void>}
     */
    async playTimeline() {

        let tms = Helpers.getTmsFromScale(+this.view.timelineRange.value);
        const newScale = Helpers.getScaleFromTms(tms + 901);
        await this.setTimeline(newScale);
        if (this.view.timelineRange.value >= 1)
            this.view.timelineRange.value = 0;
        if (this.autoplay)
            setTimeout(() => this.playTimeline(), Controller.TIMELINE_SPEED);
    }

    /**
     * Bind view
     *
     * @private
     */
    bind() {
        this.view.on('timeline_update', v => this.onTimelineUpdate(v));
        this.view.autoplayButton.addEventListener('change', e => this.onAutoPlayChange(e));
    }

    /**
     *
     * @param evt
     */
    onAutoPlayChange(evt) {
        this.autoplay = !!evt.target.checked;
        if (this.autoplay)
            setTimeout(() => this.playTimeline(), Controller.TIMELINE_SPEED);
    }

    /**
     * Manually override the timeline value
     *
     * @param v
     * @return {Promise<void>}
     */
    async setTimeline(v) {
        this.view.setTimeline(v);
        const start = Helpers.getTmsFromScale(v);
        const duration = 900; //@TODO refactor: hardcoded
        await this.model.setWindow(start, start + duration);
    }

    /**
     * When the timeline is manually updated
     *
     * @param v
     */
    async onTimelineUpdate(v) {

        this.autoplay = false;
        this.view.setAutoPlay(false);
        const start = Helpers.getTmsFromScale(v);
        const duration = 900; //@TODO refactor: hardcoded
        await this.model.setWindow(start, start + duration);
    }
}


Controller.TIMELINE_SPEED = 0;
