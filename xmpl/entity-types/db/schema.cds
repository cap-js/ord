namespace demo;

@ObjectModel.compositionRoot: true
@EntityRelationship.entityType: 'customer.entitytypes:Order:v1'
@ODM.entityName: 'Order'
@title: 'Order'
entity Orders {
    key ID: UUID;
    items: Composition of many OrderItems on items.order = $self;
}

@EntityRelationship.entityType: 'customer.entitytypes:OrderItem:v1'
@title: 'Order item'
entity OrderItems {
    key ID: UUID;
    order: Association to Orders;
    quantity: Integer;
}
