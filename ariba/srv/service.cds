namespace ariba.example;

service ExampleService {
  entity Orders {
    key ID : UUID;
    description : String;
    createdAt : DateTime;
  }
}
