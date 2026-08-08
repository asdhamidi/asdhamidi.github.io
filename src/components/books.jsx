import React from "react";

const books = [
  { title: "The Gene", author: "Siddhartha Mukherjee" },
  { title: "The God of Small Things", author: "Arundhati Roy" },
  { title: "Norwegian Wood", author: "Haruki Murakami" },
  { title: "Midnight's Children", author: "Salman Rushdie" },
  { title: "Crime and Punishment", author: "Fyodor Dostoevsky" },
  { title: "Sapiens", author: "Yuval Noah Harari" },
  { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez" },
  { title: "Gandhi: The Years That Changed the World, 1914-1948", author: "Ramachandra Guha" },
  { title: "The Emperor of All Maladies", author: "Siddhartha Mukherjee" },
  { title: "India After Gandhi", author: "Ramachandra Guha" },
  { title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams" },
  { title: "The Small Town Sea", author: "Anees Salim" },
  { title: "Masala Lab", author: "Krish Ashok" },
  { title: "City of Djinns", author: "William Dalrymple" },
  { title: "1984", author: "George Orwell" },
  { title: "Tuesdays with Morrie", author: "Mitch Albom" },
  { title: "To Kill a Mockingbird", author: "Harper Lee" },
  { title: "The Kite Runner", author: "Khaled Hosseini" },
  { title: "Tarkash", author: "Javed Akhtar" },
  { title: "Gunahon Ka Devta", author: "Dharamvir Bharati" },
  { title: "The Fault in Our Stars", author: "John Green" },
  { title: "A Town Called Dehra", author: "Ruskin Bond" },
];

function Books() {
  return (
    <div className="books">
      <h1 className="content-title">books</h1>
      <p className="section-tagline">some books I recommend</p>
      <div className="books-list">
        {books.map((book, i) => (
          <div className="book-item" key={i}>
            <span className="book-title">{book.title}</span>
            <span className="book-author">by {book.author}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Books;
