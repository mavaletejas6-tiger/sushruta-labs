/*
 * sync.js - SIMULATED offline sync queue.
 *
 * This is a frontend-only demo. Nothing is uploaded to a hospital server.
 * When the connection returns, pending local actions are marked as synced
 * in the local queue so the UI can demonstrate the pattern.
 */
window.Sync = (function () {
  'use strict';

  var syncing = false;

  async function status() {
    var pending = await Storage.getPendingSyncItems();
    return {
      offline: App.isOffline(),
      pending: pending.length,
      items: pending
    };
  }

  async function flush() {
    if (syncing) return false;
    if (App.isOffline()) {
      App.toast('🟠 Offline — changes saved locally.', 'info');
      return false;
    }
    syncing = true;
    App.updateConnectionUI();
    var nodes = document.querySelectorAll('[data-sync-status]');
    Array.prototype.forEach.call(nodes, function (n) { n.textContent = App.t('syncing'); });
    try {
      var pending = await Storage.getPendingSyncItems();
      await new Promise(function (r) { setTimeout(r, 800); });
      await Storage.markSynced(pending.map(function (i) { return i.id; }));
      if (pending.length) {
        await Storage.saveAuditLog({
          actorId: 'sync', actorRole: 'system', action: 'sync.completed',
          patientId: null,
          message: 'Simulated sync completed for ' + pending.length + ' local item(s). No real server upload occurred.'
        });
        App.toast('Sync completed (' + pending.length + ' local items). SIMULATED - no server.', 'success');
      }
      Array.prototype.forEach.call(nodes, function (n) { n.textContent = App.t('syncComplete'); });
      setTimeout(function () {
        Array.prototype.forEach.call(nodes, function (n) { n.textContent = ''; });
      }, 3500);
      App.updateConnectionUI();
      return true;
    } catch (e) {
      App.toast('Sync simulation failed - data remains stored locally.', 'error');
      return false;
    } finally {
      syncing = false;
      App.updateConnectionUI();
    }
  }

  function init() {
    window.addEventListener('online', function () { flush(); });
    document.addEventListener('vpdt:connection', function () { App.updateConnectionUI(); });
  }

  return { status: status, flush: flush, init: init, isSyncing: function () { return syncing; } };
})();
