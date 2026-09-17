const express = require('express');
const router  = express.Router();
const supabase = require('../db/supabase');
const adminAuth = require('../middleware/adminAuth');

// All admin routes require auth
router.use(adminAuth);

// ===== GET all shipments =====
router.get('/shipments', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, shipments: data });
  } catch (err) { next(err); }
});

// ===== GET single shipment with events =====
router.get('/shipments/:id', async (req, res, next) => {
  try {
    const { data: shipment, error } = await supabase
      .from('shipments').select('*').eq('id', req.params.id).single();
    if (error || !shipment) return res.status(404).json({ success: false, error: 'Not found' });

    const { data: events, error: evtErr } = await supabase
      .from('tracking_events').select('*').eq('shipment_id', req.params.id)
      .order('event_time', { ascending: false });
    if (evtErr) throw evtErr;

    res.json({ success: true, shipment, events });
  } catch (err) { next(err); }
});

// ===== CREATE shipment =====
router.post('/shipments', async (req, res, next) => {
  try {
    const {
      tracking_number, status, status_label, status_icon,
      service, weight, origin, destination, current_location,
      estimated_delivery, delivered_at, recipient, progress_step,
      map_lat, map_lng,
    } = req.body;

    const { data, error } = await supabase.from('shipments').insert([{
      tracking_number: tracking_number.toUpperCase(),
      status, status_label, status_icon: status_icon || 'fa-box',
      service, weight, origin, destination, current_location,
      estimated_delivery, delivered_at: delivered_at || null,
      recipient: recipient || null,
      progress_step: progress_step || 0,
      map_lat: map_lat || null,
      map_lng: map_lng || null,
    }]).select().single();

    if (error) throw error;
    res.status(201).json({ success: true, shipment: data });
  } catch (err) { next(err); }
});

// ===== UPDATE shipment =====
router.put('/shipments/:id', async (req, res, next) => {
  try {
    const {
      status, status_label, status_icon, service, weight,
      origin, destination, current_location, estimated_delivery,
      delivered_at, recipient, progress_step, map_lat, map_lng,
    } = req.body;

    const { data, error } = await supabase
      .from('shipments')
      .update({
        status, status_label, status_icon,
        service, weight, origin, destination, current_location,
        estimated_delivery, delivered_at: delivered_at || null,
        recipient: recipient || null,
        progress_step,
        map_lat: map_lat || null,
        map_lng: map_lng || null,
      })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    res.json({ success: true, shipment: data });
  } catch (err) { next(err); }
});

// ===== UPDATE map location only =====
router.put('/shipments/:id/location', async (req, res, next) => {
  try {
    const { map_lat, map_lng, current_location } = req.body;
    if (!map_lat || !map_lng) {
      return res.status(400).json({ success: false, error: 'map_lat and map_lng required' });
    }

    const { data, error } = await supabase
      .from('shipments')
      .update({ map_lat, map_lng, current_location })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    res.json({ success: true, shipment: data });
  } catch (err) { next(err); }
});

// ===== DELETE shipment =====
router.delete('/shipments/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('shipments').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Shipment deleted' });
  } catch (err) { next(err); }
});

// ===== ADD tracking event =====
router.post('/shipments/:id/events', async (req, res, next) => {
  try {
    const { status, location, event_time, is_latest } = req.body;

    // If is_latest, clear previous latest flag
    if (is_latest) {
      await supabase.from('tracking_events')
        .update({ is_latest: false })
        .eq('shipment_id', req.params.id);
    }

    const { data, error } = await supabase.from('tracking_events').insert([{
      shipment_id: req.params.id,
      status, location,
      event_time: event_time || new Date().toISOString(),
      is_latest: is_latest || false,
    }]).select().single();

    if (error) throw error;
    res.status(201).json({ success: true, event: data });
  } catch (err) { next(err); }
});

// ===== DELETE tracking event =====
router.delete('/events/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('tracking_events').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
