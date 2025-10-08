using {
  cuid,
  managed,
  sap.common.CodeList
} from '@sap/cds/common';

namespace sap.capire.incidents;

/**
 * Customers using products sold by our company.
 * Customers can create support Incidents.
 */
entity Customers : managed {
  key ID           : String;
      firstName    : String;
      lastName     : String;
      name         : String = firstName || ' ' || lastName;
      email        : EMailAddress;
      phone        : PhoneNumber;
      creditCardNo : String(16) @assert.format: '^[1-9]\d{15}$';
      addresses    : Composition of many Addresses
                       on addresses.customer = $self;
      incidents    : Association to many Incidents
                       on incidents.customer = $self;
}

entity Addresses : cuid, managed {
  customer_ID   : String;
  customer      : Association to Customers on customer.ID = customer_ID;
  city          : String;
  postCode      : String;
  streetAddress : String;
}


/**
 * Incidents created by Customers.
 */
entity Incidents : cuid, managed {
  customer_ID  : String;
  customer     : Association to Customers on customer.ID = customer_ID;
  title        : String @title: 'Title';
  urgency_code : String;
  urgency      : Association to Urgency on urgency.code = urgency_code;
  status_code  : String;
  status       : Association to Status on status.code = status_code;
}

entity Status : CodeList {
  key code        : String enum {
        new = 'N';
        assigned = 'A';
        in_process = 'I';
        on_hold = 'H';
        resolved = 'R';
        closed = 'C';
      };
      criticality : Integer;
}

entity Urgency : CodeList {
  key code : String enum {
        high = 'H';
        medium = 'M';
        low = 'L';
      };
}

type EMailAddress : String;
type PhoneNumber  : String;
