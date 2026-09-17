const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET /api/track?numbers=FX123,FX456
router.get('/', async (req, res, next) => {
  try {
    const raw = req.query.numbers || '';
    if (!raw.trim()) {
      return res.status(400).json({ success: false, error: 'No tracking numbers provided' });
    }

    // Parse comma/space separated numbers, max 5
    const numbers = raw
      .split(/[\s,]+/)
      .map(n => n.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 5);

    // Fetch shipments from Supabase
    const { data: shipments, error: shipErr } = await supabase
      .from('shipments')
      .select('*')
      .in('tracking_number', numbers);

    if (shipErr) throw shipErr;

    // For each found shipment, also fetch its timeline events
    const results = await Promise.all(
      numbers.map(async (num) => {
        const shipment = shipments.find(s => s.tracking_number === num);
        if (!shipment) return { tracking_number: num, found: false };

        const { data: events, error: evtErr } = await supabase
          .from('tracking_events')
          .select('*')
          .eq('shipment_id', shipment.id)
          .order('event_time', { ascending: false });

        if (evtErr) throw evtErr;

        return {
          found: true,
          tracking_number: shipment.tracking_number,
          status: shipment.status,
          status_label: shipment.status_label,
          status_icon: shipment.status_icon,
          service: shipment.service,
          weight: shipment.weight,
          origin: shipment.origin,
          destination: shipment.destination,
          current_location: shipment.current_location,
          estimated_delivery: shipment.estimated_delivery,
          delivered_at: shipment.delivered_at,
          recipient: shipment.recipient,
          progress_step: shipment.progress_step,
          map_lat: shipment.map_lat || null,
          map_lng: shipment.map_lng || null,
          timeline: events.map(e => ({
            date: new Date(e.event_time).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            }),
            status: e.status,
            location: e.location,
            latest: e.is_latest,
          })),
        };
      })
    );

    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
