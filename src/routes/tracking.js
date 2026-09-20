const express = require('express');
const router  = express.Router();
const supabase = require('../db/supabase');

// GET /api/track?numbers=FX123,FX456
router.get('/', async (req, res, next) => {
  try {
    const raw = req.query.numbers || '';
    if (!raw.trim()) {
      return res.status(400).json({ success: false, error: 'No tracking numbers provided' });
    }

    // Parse comma/space separated, max 5
    const numbers = raw
      .split(/[\s,]+/)
      .map(n => n.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 5);

    // Fetch all matching shipments in one query
    const { data: shipments, error: shipErr } = await supabase
      .from('shipments')
      .select('*')
      .in('tracking_number', numbers);

    if (shipErr) throw shipErr;

    // Fix #10: fetch ALL events for found shipments in ONE query (no N+1)
    const foundIds = shipments.map(s => s.id);
    let allEvents = [];

    if (foundIds.length > 0) {
      const { data: events, error: evtErr } = await supabase
        .from('tracking_events')
        .select('*')
        .in('shipment_id', foundIds)
        .order('event_time', { ascending: false });
      if (evtErr) throw evtErr;
      allEvents = events;
    }

    // Group events by shipment_id for fast lookup
    const eventsByShipment = allEvents.reduce((acc, e) => {
      if (!acc[e.shipment_id]) acc[e.shipment_id] = [];
      acc[e.shipment_id].push(e);
      return acc;
    }, {});

    // Build results preserving the order of requested numbers
    const results = numbers.map(num => {
      const shipment = shipments.find(s => s.tracking_number === num);
      if (!shipment) return { tracking_number: num, found: false };

      const events = eventsByShipment[shipment.id] || [];

      return {
        found: true,
        tracking_number: shipment.tracking_number,
        status:           shipment.status,
        status_label:     shipment.status_label,
        status_icon:      shipment.status_icon,
        service:          shipment.service,
        weight:           shipment.weight,
        origin:           shipment.origin,
        destination:      shipment.destination,
        current_location: shipment.current_location,
        estimated_delivery: shipment.estimated_delivery,
        delivered_at:     shipment.delivered_at,
        recipient:        shipment.recipient,
        progress_step:    shipment.progress_step,
        map_lat:          shipment.map_lat        || null,
        map_lng:          shipment.map_lng        || null,
        origin_lat:       shipment.origin_lat     || null,
        origin_lng:       shipment.origin_lng     || null,
        dest_lat:         shipment.dest_lat       || null,
        dest_lng:         shipment.dest_lng       || null,
        item_image_url:   shipment.item_image_url || null,
        pickup_time:      shipment.pickup_time    || null,
        delivery_time:    shipment.delivery_time  || null,
        timeline: events.map(e => ({
          date: new Date(e.event_time).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
          }),
          status:   e.status,
          location: e.location,
          latest:   e.is_latest,
        })),
      };
    });

    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
