-- 0137 · The listing sync may write its result back to Salesforce — once an
-- admin says so.
--
-- Version 1.2 of the Published Listings guide adds a write-back: the website
-- PATCHes Website_Status__c, Website_URL__c and Website_Error__c on each
-- Property_Listing__c, so the CRM team sees in Salesforce whether a listing
-- is live, where, and if not, why. A listing the website cannot publish is set
-- to Deactivated, which takes it out of the published set until the CRM team
-- fixes it and publishes it again.
--
-- That is a write to someone else's system, in bulk, on the first run: every
-- listing held for a missing field would be deactivated at once. So it starts
-- off. The first runs only read; an admin reads the reasons on
-- /admin/properties/salesforce, and switches write-back on when they are the
-- reasons the CRM team should see.
alter table public.salesforce_listing_sync
  add column write_back boolean not null default false;

comment on column public.salesforce_listing_sync.write_back is
  'When true, the listing sync writes Website_Status__c / Website_URL__c / Website_Error__c back to each Salesforce listing. Off until an admin turns it on; see 0137.';
