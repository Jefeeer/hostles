-- HOST LESTER — demo seed data.
-- Dates are relative to current_date so the dashboard always has something upcoming.
-- Sample deposit is 30% of the rate; this is NOT his business rule (still to be confirmed).

select setseed(0.42);

insert into public.packages (name, event_type, description, inclusions, rate, hours, sort_order) values
('Classic Wedding',      'wedding',    'Reception hosting for intimate weddings.',
  array['Reception hosting (4 hrs)','Program flow planning call','Couple''s story spiel'], 18000, 4, 1),
('Premium Wedding',      'wedding',    'Full-day hosting from cocktails to send-off.',
  array['Cocktails + reception hosting','2 planning calls','Bilingual hosting (Filipino/English)','Games & interactive segments'], 28000, 6, 2),
('Grand Wedding',        'wedding',    'Large weddings and multi-segment programs.',
  array['Full-day hosting','Unlimited planning calls','On-site coordination with suppliers','Same-day edit intro'], 38000, 8, 3),
('Debut Package',        'debut',      '18 roses, 18 candles and the full debut program.',
  array['Debut program hosting (4 hrs)','18 roses / 18 candles / 18 treasures','Games for guests'], 15000, 4, 4),
('Birthday & Celebration','birthday',  'Kids'' parties, milestone birthdays and anniversaries.',
  array['Hosting (3 hrs)','Party games','Program flow'], 9000, 3, 5),
('Corporate Event',      'corporate',  'Year-end parties, launches, conferences and awards nights.',
  array['Hosting (5 hrs)','Script review','Raffle & awards segments'], 30000, 5, 6),
('Voice-over (per project)', 'vo_project', 'Commercial, explainer, IVR or corporate AVP voice-over.',
  array['Up to 60s finished audio','1 round of revisions','Broadcast-ready WAV'], 6000, null, 7);

do $$
declare
  first_m text[] := array['Paolo','Miguel','Joshua','Carlo','Mark','John Paul','Rafael','Kevin','Angelo','Christian','Gabriel','Nathaniel','Jerome','Adrian','Ramon','Vincent','Bryan','Jericho','Patrick','Enzo'];
  first_f text[] := array['Bea','Camille','Patricia','Andrea','Nicole','Kristine','Bianca','Angelica','Jasmine','Trisha','Maria Clara','Danica','Hazel','Joanna','Rica','Sofia','Ysabel','Pia','Erika','Lovely'];
  last_n  text[] := array['Santos','Reyes','Cruz','Bautista','Garcia','Mendoza','Torres','Villanueva','Ramos','Aquino','Castillo','Dela Cruz','Navarro','Salazar','Manalo','Pascual','Domingo','Gonzales','Lim','Tan','Fernandez','Rivera','Soriano','Mercado','Valdez'];
  venues  text[] := array[
    'Hillcreek Gardens, Tagaytay','Taal Vista Hotel, Tagaytay','Fernwood Gardens, Tagaytay','Antonio''s Garden, Tagaytay',
    'Sonya''s Garden, Alfonso Cavite','Balay Indang, Indang Cavite','Light of Love Events Place, Silang Cavite',
    'Josephine''s Tagaytay','Twin Lakes, Laurel Batangas','Glass Garden Events Venue, Pasig',
    'The Manila Hotel, Ermita','The Peninsula Manila, Makati','Blue Leaf Pavilion, Taguig','Hotel Okura Manila, Pasay',
    'Casa Ibarra, Imus Cavite','Tagaytay Highlands','Marriott Grand Ballroom, Pasay','The Orchid Garden Suites, Manila'];
  corp    text[] := array['Globe Telecom Year-End Party','Unilab Sales Awards Night','Jollibee Store Managers Summit','BDO Christmas Party','Ayala Land Launch','SM Supermalls Town Hall','PLDT Family Day','Cebu Pacific Pilots Gala'];
  vo      text[] := array['GCash TVC Tag','Puregold Radio Spot','Mercury Drug IVR','DOH Explainer Video','Meralco Corporate AVP','Shopee 11.11 Teaser','Smart Promo Reel','Lazada Brand Video'];

  i int;
  d date;
  et public.event_type;
  r double precision;
  cid uuid;
  bid uuid;
  pkg record;
  st public.booking_status;
  rate numeric;
  dep numeric;
  groom text; bride text; ln1 text; ln2 text;
  ttl text; ven text; stime time; etime time;
  days_out int;
begin
  for i in 1..170 loop
    -- spread from ~13 months ago to ~6 months ahead, biased toward weekends
    d := current_date - 400 + floor(random() * 580)::int;
    if extract(isodow from d) < 5 and random() < 0.65 then
      d := d + (6 - extract(isodow from d)::int);   -- push to Saturday
    end if;

    r := random();
    et := case
      when r < 0.50 then 'wedding'
      when r < 0.62 then 'debut'
      when r < 0.72 then 'birthday'
      when r < 0.84 then 'corporate'
      when r < 0.96 then 'vo_project'
      else 'other' end;

    groom := first_m[1 + floor(random() * array_length(first_m, 1))::int];
    bride := first_f[1 + floor(random() * array_length(first_f, 1))::int];
    ln1   := last_n[1 + floor(random() * array_length(last_n, 1))::int];
    ln2   := last_n[1 + floor(random() * array_length(last_n, 1))::int];
    ven   := venues[1 + floor(random() * array_length(venues, 1))::int];

    if et = 'wedding' then
      insert into public.clients (full_name, partner_name, email, phone, city, pronunciation_notes, story)
      values (bride || ' ' || ln2, groom || ' ' || ln1,
              lower(replace(bride, ' ', '')) || '.' || lower(replace(ln2, ' ', '')) || '@gmail.com',
              '09' || (170000000 + floor(random() * 99999999))::bigint::text,
              split_part(ven, ', ', 2),
              case when random() < 0.4 then ln1 || ' — stress on 2nd syllable' end,
              case when random() < 0.5 then 'Met in college at UST; ' || (3 + floor(random() * 8))::int || ' years together. Proposal was in ' || (array['Baguio','Siargao','Batangas','Boracay','Japan'])[1 + floor(random() * 5)::int] || '.' end)
      returning id into cid;
      ttl := groom || ' & ' || bride || ' Wedding';
    elsif et = 'corporate' then
      ttl := corp[1 + floor(random() * array_length(corp, 1))::int];
      insert into public.clients (full_name, email, phone, city, notes)
      values (groom || ' ' || ln1, lower(replace(groom, ' ', '')) || '.' || lower(replace(ln1, ' ', '')) || '@company.ph',
              '09' || (170000000 + floor(random() * 99999999))::bigint::text, 'Metro Manila', 'Events / HR contact for ' || ttl)
      returning id into cid;
    elsif et = 'vo_project' then
      ttl := vo[1 + floor(random() * array_length(vo, 1))::int];
      ven := 'Remote / home studio';
      insert into public.clients (full_name, email, phone, notes)
      values (bride || ' ' || ln2, lower(replace(bride, ' ', '')) || '@agency.ph',
              '09' || (170000000 + floor(random() * 99999999))::bigint::text, 'Agency producer')
      returning id into cid;
    else
      insert into public.clients (full_name, email, phone, city)
      values (case when random() < 0.5 then bride else groom end || ' ' || ln1,
              lower(replace(groom, ' ', '')) || lower(replace(ln1, ' ', '')) || '@yahoo.com',
              '09' || (170000000 + floor(random() * 99999999))::bigint::text, split_part(ven, ', ', 2))
      returning id into cid;
      ttl := case et
        when 'debut' then bride || '''s 18th Birthday'
        when 'birthday' then (array['Baby ','Lolo ','Tita ','Kuya '])[1 + floor(random() * 4)::int] || groom || '''s ' || (array['1st','7th','60th','50th','40th'])[1 + floor(random() * 5)::int] || ' Birthday'
        else ln1 || ' Family Reunion' end;
    end if;

    select * into pkg from public.packages p
      where p.event_type = et order by random() limit 1;
    rate := coalesce(pkg.rate, 12000) + (floor(random() * 5) * 1000);
    if et = 'vo_project' then rate := (3500 + floor(random() * 12) * 1000); end if;
    dep  := round(rate * 0.30, -2);

    stime := case when et = 'vo_project' then time '10:00'
                  when random() < 0.3 then time '11:00' else time '17:00' end;
    etime := stime + case when et = 'vo_project' then interval '2 hours' else make_interval(hours => coalesce(pkg.hours, 4)::int) end;

    days_out := d - current_date;
    r := random();
    st := case
      when days_out < 0  then case when r < 0.08 then 'cancelled' else 'done' end
      when days_out < 14 then case when r < 0.55 then 'fully_paid' when r < 0.9 then 'deposit_paid' else 'signed' end
      when days_out < 60 then case when r < 0.45 then 'deposit_paid' when r < 0.65 then 'signed' when r < 0.8 then 'contract_sent' when r < 0.9 then 'on_hold' else 'inquiry' end
      else case when r < 0.3 then 'deposit_paid' when r < 0.45 then 'contract_sent' when r < 0.7 then 'on_hold' else 'inquiry' end
    end;

    insert into public.bookings (client_id, title, event_type, event_date, start_time, end_time, venue,
                                 package_id, rate, deposit_amount, status, hold_expires_at, source, coordinator, guest_count,
                                 cancelled_reason, created_at)
    values (cid, ttl, et, d, stime, etime, ven, pkg.id, rate, dep, st,
            case when st = 'on_hold' then now() + make_interval(days => 1 + floor(random() * 10)::int) end,
            case when st = 'inquiry' and random() < 0.6 then 'public_form' else 'manual' end,
            case when et in ('wedding','debut') and random() < 0.6 then (array['Ivy of Juan & Juana Events','Team Mimi Coordination','Gela Weddings','Blissful Days PH'])[1 + floor(random() * 4)::int] end,
            case when et = 'vo_project' then null else (80 + floor(random() * 22) * 10)::int end,
            case when st = 'cancelled' then 'Event postponed indefinitely' end,
            least(now(), (d - 120 + floor(random() * 60)::int)::timestamptz))
    returning id into bid;

    -- payments consistent with status
    if st in ('deposit_paid','fully_paid','done') then
      insert into public.payments (booking_id, kind, method, amount, paid_on, reference, verified_at)
      values (bid, 'deposit', (array['gcash','gcash','bank_transfer']::public.payment_method[])[1 + floor(random() * 3)::int],
              dep, least(current_date, d - 60), 'GC' || (1000000000 + floor(random() * 899999999))::bigint, now());
    end if;
    if st in ('fully_paid') or (st = 'done' and random() < 0.9) then
      insert into public.payments (booking_id, kind, method, amount, paid_on, reference, verified_at)
      values (bid, 'balance', (array['gcash','bank_transfer','cash']::public.payment_method[])[1 + floor(random() * 3)::int],
              rate - dep, least(current_date, d - 3), 'BT' || (1000000000 + floor(random() * 899999999))::bigint, now());
    end if;
    -- an unverified proof waiting for one-click verification
    if st = 'signed' and random() < 0.5 then
      insert into public.payments (booking_id, kind, method, amount, paid_on, reference)
      values (bid, 'deposit', 'gcash', dep, current_date - 1, 'GC' || (1000000000 + floor(random() * 899999999))::bigint);
    end if;

    insert into public.activity_log (actor, entity_type, entity_id, action, summary)
    values ('system', 'booking', bid, 'booking.created', 'Seeded: ' || ttl);
  end loop;
end $$;

-- ─── Special events: Kasalang Tagaytay (mass wedding) ───────────────────────
do $$
declare
  s uuid;
  past uuid;
  nxt uuid;
  flds jsonb := '[{"key":"groom","label":"Groom","type":"text"},{"key":"bride","label":"Bride","type":"text"},{"key":"barangay","label":"Barangay","type":"text"},{"key":"license","label":"Marriage license","type":"select","options":["Pending","Submitted","Approved"]}]';
  couples text[][] := array[
    ['Jun Dela Cruz','Mae Ramos','Kaybagal South','Approved'], ['Ronnie Santos','Liza Mercado','Silang Junction','Approved'],
    ['Mark Villanueva','Joy Bautista','Maharlika East','Submitted'], ['Arnel Garcia','Rose Aquino','Sungay West','Approved'],
    ['Dennis Reyes','Grace Navarro','Iruhin Central','Pending'], ['Paolo Cruz','Ana Flores','Patutong Malaki','Submitted']];
  i int;
begin
  insert into public.event_series (name, description)
  values ('Kasalang Tagaytay', 'City-sponsored mass wedding. Lester hosts the ceremony and program.') returning id into s;

  insert into public.event_editions (series_id, name, event_date, start_time, end_time, venue, status, fee_mode, flat_fee, fields)
  values (s, 'Kasalang Tagaytay ' || extract(year from current_date - 330)::int, (current_date - 330), '09:00', '13:00',
          'Tagaytay City Convention Center', 'done', 'flat', 25000, flds) returning id into past;
  insert into public.event_editions (series_id, name, event_date, start_time, end_time, venue, status, fee_mode, per_entry_fee, fields)
  values (s, 'Kasalang Tagaytay ' || extract(year from current_date + 45)::int, (current_date + 45), '09:00', '13:00',
          'Tagaytay City Convention Center', 'open', 'per_entry', 1500, flds) returning id into nxt;

  for i in 1 .. array_length(couples, 1) loop
    insert into public.edition_entries (edition_id, name, data, paid)
    values (past, couples[i][1] || ' & ' || couples[i][2],
            jsonb_build_object('groom', couples[i][1], 'bride', couples[i][2], 'barangay', couples[i][3], 'license', 'Approved'), 0);
    insert into public.edition_entries (edition_id, name, contact, data, paid)
    values (nxt, split_part(couples[i][1], ' ', 1) || ' & ' || couples[i][2], '0917' || lpad((1000000 + i * 7919)::text, 7, '0'),
            jsonb_build_object('groom', couples[i][1], 'bride', couples[i][2], 'barangay', couples[i][3], 'license', couples[i][4]),
            case when i <= 3 then 1500 else 0 end);
  end loop;
end $$;
