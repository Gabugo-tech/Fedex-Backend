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
      map_lat, map_lng, origin_lat, origin_lng, dest_lat, dest_lng,
      pickup_time, delivery_time,
    } = req.body;

    // Fix #9: validate required fields
    const missing = [];
    if (!tracking_number?.trim()) missing.push('tracking_number');
    if (!status?.trim())          missing.push('status');
    if (!status_label?.trim())    missing.push('status_label');
    if (!service?.trim())         missing.push('service');
    if (!origin?.trim())          missing.push('origin');
    if (!destination?.trim())     missing.push('destination');
    if (!current_location?.trim()) missing.push('current_location');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const validStatuses = ['pending', 'in-transit', 'out-delivery', 'delivered', 'exception'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const step = parseInt(progress_step);
    if (isNaN(step) || step < 0 || step > 4) {
      return res.status(400).json({ success: false, error: 'progress_step must be 0–4' });
    }

    const { data, error } = await supabase.from('shipments').insert([{
      tracking_number: tracking_number.trim().toUpperCase(),
      status,
      status_label,
      status_icon: status_icon || 'fa-box',
      service,
      weight: weight || null,
      origin,
      destination,
      current_location,
      estimated_delivery: estimated_delivery || null,
      delivered_at: delivered_at || null,
      recipient: recipient || null,
      progress_step: step,
      map_lat: map_lat || null,
      map_lng: map_lng || null,
      origin_lat: origin_lat || null,
      origin_lng: origin_lng || null,
      dest_lat:   dest_lat   || null,
      dest_lng:   dest_lng   || null,
      pickup_time:   pickup_time   || null,
      delivery_time: delivery_time || null,
    }]).select().single();

    if (error) {
      // Handle duplicate tracking number gracefully
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Tracking number already exists' });
      }
      throw error;
    }
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
      origin_lat, origin_lng, dest_lat, dest_lng,
      pickup_time, delivery_time,
    } = req.body;

    // Fix: validate required fields on update too
    const missing = [];
    if (!status?.trim())           missing.push('status');
    if (!status_label?.trim())     missing.push('status_label');
    if (!service?.trim())          missing.push('service');
    if (!origin?.trim())           missing.push('origin');
    if (!destination?.trim())      missing.push('destination');
    if (!current_location?.trim()) missing.push('current_location');
    if (missing.length > 0) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('shipments')
      .update({
        status, status_label, status_icon,
        service, weight: weight || null,
        origin, destination, current_location,
        estimated_delivery: estimated_delivery || null,
        delivered_at: delivered_at || null,
        recipient: recipient || null,
        progress_step,
        map_lat: map_lat || null,
        map_lng: map_lng || null,
        origin_lat: origin_lat || null,
        origin_lng: origin_lng || null,
        dest_lat:   dest_lat   || null,
        dest_lng:   dest_lng   || null,
        pickup_time:   pickup_time   || null,
        delivery_time: delivery_time || null,
      })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Shipment not found' });
    res.json({ success: true, shipment: data });
  } catch (err) { next(err); }
});

// ===== UPDATE map location only =====
router.put('/shipments/:id/location', async (req, res, next) => {
  try {
    const { map_lat, map_lng, current_location } = req.body;
    if (!map_lat || !map_lng) {
      return res.status(400).json({ success: false, error: 'map_lat and map_lng are required' });
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

    if (!status?.trim() || !location?.trim()) {
      return res.status(400).json({ success: false, error: 'status and location are required' });
    }

    // If is_latest, clear previous latest flag first
    if (is_latest) {
      await supabase.from('tracking_events')
        .update({ is_latest: false })
        .eq('shipment_id', req.params.id);
    }

    const { data, error } = await supabase.from('tracking_events').insert([{
      shipment_id: req.params.id,
      status: status.trim(),
      location: location.trim(),
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

// ===== UPLOAD item image =====
router.post('/shipments/:id/image', async (req, res, next) => {
  try {
    // Expect base64 encoded image in body: { base64, mimeType }
    const { base64, mimeType } = req.body;

    if (!base64 || !mimeType) {
      return res.status(400).json({ success: false, error: 'base64 and mimeType are required' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(mimeType)) {
      return res.status(400).json({ success: false, error: 'Only JPEG, PNG, WebP and GIF images are allowed' });
    }

    // Decode base64 to buffer
    const buffer = Buffer.from(base64, 'base64');

    // Max 5MB
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Image must be under 5MB' });
    }

    const ext      = mimeType.split('/')[1];
    const fileName = `${req.params.id}-${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('shipment-images')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('shipment-images')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    // Save URL to shipment record
    const { data, error: updateErr } = await supabase
      .from('shipments')
      .update({ item_image_url: imageUrl })
      .eq('id', req.params.id)
      .select().single();

    if (updateErr) throw updateErr;

    res.json({ success: true, item_image_url: imageUrl, shipment: data });
  } catch (err) { next(err); }
});

// ===== DELETE item image =====
router.delete('/shipments/:id/image', async (req, res, next) => {
  try {
    // Get current image URL
    const { data: shipment } = await supabase
      .from('shipments').select('item_image_url').eq('id', req.params.id).single();

    if (shipment?.item_image_url) {
      // Extract filename from URL
      const parts    = shipment.item_image_url.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('shipment-images').remove([fileName]);
    }

    // Clear URL from shipment
    await supabase.from('shipments')
      .update({ item_image_url: null })
      .eq('id', req.params.id);

    res.json({ success: true, message: 'Image deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
