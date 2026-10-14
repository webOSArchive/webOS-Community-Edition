/**
 * TaskGroup holds a group of tasks that can be executed all together.  The operations from different
 * components can be added/removed to the same TaskGroup as tasks that can be executed, or can be
 * scheduled to execute all in one batch.
 *
 * Usage:
 * 1. addTask() -  add a task to this task group.
 * 2. removeTask() - remove a task from this task group.
 * 3. schedule() - schedule/re-schedule to execute all tasks in this group after number of milliseconds
 *                 from now.
 * 4. cancel() -   cancel a scheduled execution if one is scheduled and has yet to been executed.
 * 5. execute() -  execute all tasks in this task group immediately.  It also clears any scheduled execution.
 * 6. destroy() -  destroy this task group.
 */

enyo.kind({
    name: "TaskGroup",
    kind: enyo.Component,
    //published: { },
    //events: { },
    create: function() {
        this.inherited(arguments);
        this.tasks = {};
        this.count = 0;
    },

    /**
     * Add a task to this task group.
     *
     * @param task It is an object containing the following properties.
     *        { method, (required) it is the function to be invoked.
     *          args,   (optional) it is an array of parameters to be passed onto the method.
     *          scope   (optional) it is an object instance that can be referenced as the 'this' from
     *        }                    inside of the method.  It it is omitted, then the 'this' would
     *                             refer to the window.
     * @return It returns a task ID that can be passed onto the removeTask() method to remove this
     *         task from this task group.
     */
    addTask: function (task) {
        var tid = this.getNewTaskId();
        if (!tid) { return null; }
        this.tasks[tid] = task;
        this.count++;
        return tid;
    },

    /**
     * Remove a task from this task group.
     *
     * @param taskId It is the ID of the task to be removed.  This taskId is returned by the addTask()
     *               method.
     */
    removeTask: function (taskId) {
        if (!taskId) { return; }
        if (this.tasks[taskId]) {
            delete this.tasks[taskId];
            this.count--;
        }
    },

    /**
     * Schedule to run this task group.  If one is already scheduled, then it is re-scheduled to
     * the new miliSeconds.
     *
     * @param miliSeconds It is number of milliseconds from now to execute all tasks in this task group.
     */
    schedule: function (miliSeconds) {
        var thisInst = this;
        if (this.pendingJobId) {
            clearTimeout(this.pendingJobId);
            delete this.pendingJobId;
        }
        this.pendingJobId = setTimeout(function () { thisInst.execute(); }, miliSeconds);
    },

    /**
     * Cancel the schedule to execute this task group.
     */
    cancel: function () {
        if (this.pendingJobId) {
            clearTimeout(this.pendingJobId);
            delete this.pendingJobId;
        }
    },

    /**
     * Execute all tasks in this task group.  Each registered task is invoked one after another
     * until all tasks are completed.  In case of long running tasks, and if the abandExecute() is
     * called during the execution, then all the remaining un-executed tasks will not be invked.
     *
     * If this execute() is called independantly from a pending scheduled run, than the pending
     * schedule will be canceled.
     */
    execute: function () {
        var tid = undefined;
        if (this.pendingJobId) { this.cancel(); }
        if (this.tasks) {
            for (tid in this.tasks) if (this.tasks.hasOwnProperty(tid)) {
                if (this.aband) { break; }
                this.runTask(this.tasks[tid]);
            }
        }
    },

    /**
     * Run one task.
     *
     * @param task is an object describing a task.  (@see addTask())
     */
    runTask: function (task) {
        var args = undefined;
        if (!task || !task.method || typeof task.method != "function") { return; }
        var scope = task.scope ? task.scope : window;
        if (task.args) { args = task.args; }
        task.method.apply(scope, args);
    },

    abandExecute: function () {
        this.aband = true;
    },

    getNewTaskId: function () {
        var now = new Date();
        var tid = "t"+now.getTime();
        var i = 0;
        if (this.tasks[tid]) {
            // it is unlikely to happen; just in case if the tid is not unique, then try three more times
            for (i = 0; i < 3; i++) {
                tid = this.getNewTaskId();
                if (!this.tasks[tid]) { return tid; }
            }
            return null;  // after three failure attempts, then returns null (it is unlikely to happen)
        }
        return tid;
    },

    destroy: function () {
        var t;
        if (this.pendingJobId) { this.cancel(); }
        if (this.tasks) {
            for (t in this.tasks) if (this.tasks.hasOwnProperty(t)) {
                delete this.tasks[t];
            }
            delete this.tasks;
        }
        this.inherited(arguments);
    }
});
